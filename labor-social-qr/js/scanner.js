// Variables globales
let html5QrcodeScanner = null;
let escaneando = false;
let contadorAsistencias = 0;
let ultimoQR = '';
let ultimoTiempo = 0;
let audioContext = null;

// Inicializar al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    verificarAcceso();
    cargarContadorLocal();
    iniciarScanner();
    initAudio();
});

// Verificar acceso del usuario
function verificarAcceso() {
    const email = localStorage.getItem('userEmail');
    if (email) {
        document.getElementById('usuarioInfo').textContent = email.split('@')[0];
        verificarAutorizacionBackend(email);
    } else {
        // Si no hay email guardado, pedirlo
        solicitarEmail();
    }
}

function solicitarEmail() {
    const email = prompt('Por favor ingresa tu correo institucional:');
    if (email && email.includes('@')) {
        localStorage.setItem('userEmail', email);
        verificarAutorizacionBackend(email);
    } else {
        alert('Correo inválido');
        solicitarEmail();
    }
}

function verificarAutorizacionBackend(email) {
    fetch(`${CONFIG.BACKEND_URL}?action=verificar&email=${encodeURIComponent(email)}`)
        .then(response => response.json())
        .then(data => {
            if (!data.autorizado) {
                document.body.innerHTML = `
                    <div class="error-container">
                        <div class="error-icon">🚫</div>
                        <h2>Acceso Denegado</h2>
                        <p>Tu correo (${email}) no está autorizado.</p>
                        <button onclick="localStorage.clear(); location.reload()">Reintentar</button>
                    </div>
                `;
            }
        })
        .catch(error => console.error('Error verificando acceso:', error));
}

// Inicializar audio
function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) {
        console.log('Audio no soportado');
    }
}

// Sonido de éxito
function playSuccessSound() {
    if (!audioContext) return;
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.15);
    } catch(e) {}
}

// Iniciar escáner
function iniciarScanner() {
    const readerElement = document.getElementById('reader');
    if (!readerElement) return;

    html5QrcodeScanner = new Html5Qrcode("reader");
    
    const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
    };

    html5QrcodeScanner.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        onScanError
    ).catch(err => {
        console.error('Error iniciando cámara:', err);
        document.getElementById('reader').innerHTML = `
            <div class="camera-error">
                ⚠️ Error de cámara<br>
                <small>Verifica los permisos</small>
                <button onclick="reiniciarScanner()" class="btn btn-warning">Reintentar</button>
            </div>
        `;
    });
}

// Éxito al escanear
function onScanSuccess(decodedText, decodedResult) {
    const ahora = new Date().getTime();
    
    // Verificar cooldown
    if (escaneando) return;
    if (decodedText === ultimoQR && (ahora - ultimoTiempo) < CONFIG.SCAN_COOLDOWN) return;
    if ((ahora - ultimoTiempo) < 2000) return;

    // Bloquear escáner
    escaneando = true;
    ultimoQR = decodedText;
    ultimoTiempo = ahora;

    // Mostrar indicador de bloqueo
    document.getElementById('cooldownMessage').style.display = 'block';
    if (html5QrcodeScanner) {
        html5QrcodeScanner.pause();
    }

    // Mostrar tarjeta del estudiante
    mostrarTarjetaEstudiante(decodedText);
    
    // Registrar asistencia
    registrarAsistencia(decodedText);
}

function onScanError(error) {
    // Ignorar errores de escaneo
}

function mostrarTarjetaEstudiante(id) {
    const card = document.getElementById('studentCard');
    card.style.display = 'block';
    document.getElementById('studentId').innerText = `🆔 ${id}`;
    document.getElementById('studentName').innerText = '🔍 Buscando...';
    document.getElementById('statusBadge').className = 'status-badge status-loading';
    document.getElementById('statusBadge').innerText = '⏳ Verificando...';
    document.getElementById('studentPhoto').innerHTML = '<div class="no-photo">⏳</div>';
    
    // Scroll suave a la tarjeta
    setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
}

function registrarAsistencia(id) {
    const email = localStorage.getItem('userEmail');
    
    fetch(`${CONFIG.BACKEND_URL}?action=registrar`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            idEstudiante: id,
            docente: email,
            timestamp: new Date().toISOString()
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Actualizar UI con éxito
            document.getElementById('studentName').innerText = `👤 ${data.nombre}`;
            document.getElementById('statusBadge').className = 'status-badge status-success';
            document.getElementById('statusBadge').innerText = '✅ Registrado';
            
            // Mostrar foto si existe
            if (data.foto) {
                const photoContainer = document.getElementById('studentPhoto');
                photoContainer.innerHTML = `<img src="${data.foto}" alt="Foto estudiante">`;
            }
            
            // Incrementar contador
            contadorAsistencias++;
            document.getElementById('contadorNumero').innerText = contadorAsistencias;
            localStorage.setItem('asistenciasHoy', contadorAsistencias);
            
            // Sonido de éxito
            playSuccessSound();
            
            // Programar reinicio
            setTimeout(reiniciarScanner, CONFIG.SCAN_COOLDOWN);
        } else {
            throw new Error(data.error || 'Error al registrar');
        }
    })
    .catch(error => {
        document.getElementById('studentName').innerText = '❌ Error';
        document.getElementById('statusBadge').className = 'status-badge status-error';
        document.getElementById('statusBadge').innerText = `⚠️ ${error.message}`;
        setTimeout(reiniciarScanner, 3000);
    });
}

function reiniciarScanner() {
    escaneando = false;
    document.getElementById('studentCard').style.display = 'none';
    document.getElementById('cooldownMessage').style.display = 'none';
    
    if (html5QrcodeScanner) {
        html5QrcodeScanner.resume();
    }
}

function cargarContadorLocal() {
    const guardado = localStorage.getItem('asistenciasHoy');
    if (guardado) {
        contadorAsistencias = parseInt(guardado);
        document.getElementById('contadorNumero').innerText = contadorAsistencias;
    }
}

// Limpiar contador al iniciar nuevo día
function resetearContadorDiario() {
    const ultimoReset = localStorage.getItem('ultimoReset');
    const hoy = new Date().toDateString();
    
    if (ultimoReset !== hoy) {
        localStorage.setItem('asistenciasHoy', '0');
        localStorage.setItem('ultimoReset', hoy);
        contadorAsistencias = 0;
        document.getElementById('contadorNumero').innerText = '0';
    }
}

// Llamar al reset diario
resetearContadorDiario();
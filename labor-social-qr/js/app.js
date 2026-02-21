// Configuración inicial
document.addEventListener('DOMContentLoaded', function() {
    mostrarUsuario();
});

function mostrarUsuario() {
    const email = localStorage.getItem('userEmail');
    if (email) {
        document.getElementById('usuarioInfo').innerHTML = `
            <span class="user-email">👤 ${email.split('@')[0]}</span>
            <button onclick="cerrarSesion()" class="logout-btn">🚪</button>
        `;
    } else {
        window.location.href = 'index.html';
    }
}

function cerrarSesion() {
    localStorage.clear();
    window.location.href = 'index.html';
}

// Función para abrir el dashboard
function abrirDashboard() {
    window.location.href = 'dashboard.html';
}
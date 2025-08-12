// ===== VARIABLES GLOBALES =====
let detectionActive = false;
let recognitionActive = false;
let currentSource = null;

// ===== ELEMENTOS DOM =====
const videoFeed = document.getElementById('videoFeed');
const placeholder = document.getElementById('placeholder');
const fileInput = document.getElementById('fileInput');
const progressCircle = document.getElementById('progressCircle');
const progressText = document.getElementById('progressText');
const activityLog = document.getElementById('activityLog');
const detectionIndicator = document.getElementById('detectionIndicator');
const recognitionIndicator = document.getElementById('recognitionIndicator');

const eppElements = {
    casco: document.getElementById('statusCasco'),
    gafas: document.getElementById('statusGafas'),
    chaleco: document.getElementById('statusChaleco'),
    guantes: document.getElementById('statusGuantes')
};

const eppLabels = {
    casco: { detected: 'CASCO<br>DETECTADO', notDetected: 'CASCO<br>NO DETECTADO' },
    gafas: { detected: 'GAFAS<br>DETECTADAS', notDetected: 'GAFAS<br>NO DETECTADAS' },
    chaleco: { detected: 'CHALECO<br>DETECTADO', notDetected: 'CHALECO<br>NO DETECTADO' },
    guantes: { detected: 'GUANTES<br>DETECTADOS', notDetected: 'GUANTES<br>NO DETECTADOS' }
};

// ===== FUNCIONES PRINCIPALES =====
function updateEPPStatus(status) {
    let detectedCount = 0;
    
    Object.keys(eppElements).forEach(key => {
        const element = eppElements[key];
        const detected = status[key] || false;
        
        if (element) {
            const textElement = element.querySelector('.epp-text');
            if (textElement) {
                textElement.innerHTML = detected ? eppLabels[key].detected : eppLabels[key].notDetected;
            }
            
            if (detected) {
                element.classList.add('detected');
                detectedCount++;
            } else {
                element.classList.remove('detected');
            }
        }
    });
    
    updateChart(detectedCount, 4);
    
    if (status.persona && detectionActive) {
        logActivity(detectedCount === 4 ? 'success' : 'warning', 
                   detectedCount === 4 ? 'EPP completo detectado' : `EPP incompleto (${detectedCount}/4)`);
    }
}

function updateChart(detected, total) {
    if (!progressCircle || !progressText) return;
    
    const percentage = Math.round((detected / total) * 100);
    const circumference = 2 * Math.PI * 35;
    const progress = (percentage / 100) * circumference;
    
    progressCircle.style.strokeDasharray = `${progress} ${circumference}`;
    progressText.textContent = `${percentage}%`;
    
    // Cambiar color
    if (percentage === 100) {
        progressCircle.style.stroke = '#00d084';
    } else if (percentage >= 75) {
        progressCircle.style.stroke = '#ff6b35';
    } else {
        progressCircle.style.stroke = '#ff4757';
    }
}

function logActivity(type, message) {
    if (!activityLog) return;
    
    const now = new Date();
    const time = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    
    const logItem = document.createElement('div');
    logItem.className = `log-item ${type}`;
    logItem.innerHTML = `
        <span class="log-time">${time}</span>
        <span class="log-msg">${message}</span>
    `;
    
    activityLog.insertBefore(logItem, activityLog.firstChild);
    
    // Mantener solo últimas 10 entradas
    while (activityLog.children.length > 10) {
        activityLog.removeChild(activityLog.lastChild);
    }
}

function toggleVideo(show) {
    if (show) {
        videoFeed.style.display = 'block';
        placeholder.style.display = 'none';
    } else {
        videoFeed.style.display = 'none';
        placeholder.style.display = 'flex';
    }
}

function updateIndicators() {
    detectionIndicator.classList.toggle('active', detectionActive);
    recognitionIndicator.classList.toggle('active', recognitionActive);
}

function updateButtons() {
    document.getElementById('btnDetection').classList.toggle('active', detectionActive);
    document.getElementById('btnRecognition').classList.toggle('active', recognitionActive);
    document.getElementById('btnCamera').classList.toggle('active', currentSource === 'camera');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function resetEPP() {
    updateEPPStatus({ casco: false, gafas: false, chaleco: false, guantes: false, persona: false });
}

async function pollStatus() {
    if (!detectionActive) return;
    
    try {
        const response = await fetch('/get_detection_status');
        const status = await response.json();
        updateEPPStatus(status);
    } catch (error) {
        console.error('Error:', error);
    }
}

function flashEffect() {
    const flash = document.createElement('div');
    flash.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(255,255,255,0.8); z-index: 9999; pointer-events: none;
        animation: flash 0.3s ease-out;
    `;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 300);
}

// ===== EVENT LISTENERS =====

// Dropdown menú
document.getElementById('menuBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelector('.dropdown').classList.toggle('show');
});

document.addEventListener('click', () => {
    document.querySelector('.dropdown').classList.remove('show');
});

document.getElementById('viewExcelBtn').addEventListener('click', async () => {
    try {
        const response = await fetch('/open_excel');
        const result = await response.json();
        showNotification(result.success ? 'Excel abierto' : 'Error abriendo Excel', 
                        result.success ? 'success' : 'error');
        if (result.success) logActivity('info', 'Registro consultado');
    } catch (error) {
        showNotification('Error de conexión', 'error');
    }
});

document.getElementById('exitBtn').addEventListener('click', () => {
    if (confirm('¿Salir de la aplicación?')) {
        window.close();
        setTimeout(() => window.location.href = 'about:blank', 100);
    }
});

document.getElementById('refreshBtn').addEventListener('click', () => {
    location.reload();
});

// Controles principales
document.getElementById('btnLoad').addEventListener('click', () => fileInput.click());

document.getElementById('fileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/upload_file', { method: 'POST', body: formData });
        const result = await response.json();
        
        if (result.success) {
            currentSource = result.type;
            
            if (result.type === 'image') {
                videoFeed.src = result.url;
            } else {
                videoFeed.src = '/video_feed?t=' + Date.now();
            }
            
            toggleVideo(true);
            resetEPP();
            updateButtons();
            showNotification(`${result.type} cargado`, 'success');
            logActivity('info', `${result.type} cargado: ${result.filename}`);
        } else {
            showNotification('Error cargando archivo', 'error');
        }
    } catch (error) {
        showNotification('Error de conexión', 'error');
    }
});

document.getElementById('btnExcel').addEventListener('click', async () => {
    try {
        const response = await fetch('/open_excel');
        const result = await response.json();
        showNotification(result.success ? 'Registro abierto' : 'Error', 
                        result.success ? 'success' : 'error');
    } catch (error) {
        showNotification('Error', 'error');
    }
});

document.getElementById('btnRecognition').addEventListener('click', async () => {
    try {
        const response = await fetch('/toggle_recognition', { method: 'POST' });
        const result = await response.json();
        
        recognitionActive = result.active;
        updateIndicators();
        updateButtons();
        showNotification(`Reconocimiento ${recognitionActive ? 'activado' : 'desactivado'}`, 
                        recognitionActive ? 'success' : 'info');
        logActivity('info', `Reconocimiento ${recognitionActive ? 'ON' : 'OFF'}`);
    } catch (error) {
        showNotification('Error', 'error');
    }
});

document.getElementById('btnDetection').addEventListener('click', async () => {
    try {
        const response = await fetch('/toggle_detection', { method: 'POST' });
        const result = await response.json();
        
        detectionActive = result.active;
        updateIndicators();
        updateButtons();
        showNotification(`Detección ${detectionActive ? 'activada' : 'desactivada'}`, 
                        detectionActive ? 'success' : 'info');
        logActivity('info', `Detección EPP ${detectionActive ? 'ON' : 'OFF'}`);
        
        if (!detectionActive) resetEPP();
    } catch (error) {
        showNotification('Error', 'error');
    }
});

document.getElementById('btnCapture').addEventListener('click', async () => {
    if (!currentSource) {
        showNotification('No hay fuente activa', 'error');
        return;
    }

    try {
        const response = await fetch('/capture_frame', { method: 'POST' });
        const result = await response.json();
        
        if (result.success) {
            showNotification(`Capturado: ${result.filename}`, 'success');
            logActivity('success', `Captura: ${result.filename}`);
            flashEffect();
        } else {
            showNotification('Error capturando', 'error');
        }
    } catch (error) {
        showNotification('Error', 'error');
    }
});

document.getElementById('btnCamera').addEventListener('click', async () => {
    try {
        if (currentSource === 'camera') {
            const response = await fetch('/stop_camera', { method: 'POST' });
            const result = await response.json();
            
            if (result.success) {
                currentSource = null;
                toggleVideo(false);
                showNotification('Cámara desactivada', 'info');
                logActivity('info', 'Cámara OFF');
            }
        } else {
            const response = await fetch('/start_camera', { method: 'POST' });
            const result = await response.json();
            
            if (result.success) {
                currentSource = 'camera';
                videoFeed.src = '/video_feed?t=' + Date.now();
                toggleVideo(true);
                resetEPP();
                showNotification('Cámara activada', 'success');
                logActivity('success', 'Cámara ON');
            } else {
                showNotification('Error con cámara', 'error');
            }
        }
        
        updateButtons();
        updateIndicators();
    } catch (error) {
        showNotification('Error', 'error');
    }
});

// Manejo de errores de video
videoFeed.addEventListener('error', () => {
    toggleVideo(false);
    currentSource = null;
    updateButtons();
    showNotification('Error en video', 'error');
});

// Shortcuts de teclado
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    
    const shortcuts = {
        '1': 'btnLoad',
        '2': 'btnExcel', 
        '3': 'btnRecognition',
        '4': 'btnDetection',
        '5': 'btnCapture',
        '6': 'btnCamera'
    };
    
    if (shortcuts[e.key]) {
        document.getElementById(shortcuts[e.key]).click();
    }
    
    if (e.key === 'Escape') {
        location.reload();
    }
});

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', async () => {
    // Obtener estado inicial
    try {
        const response = await fetch('/get_initial_state');
        const state = await response.json();
        
        detectionActive = state.detection_active || false;
        recognitionActive = state.recognition_active || false;
        currentSource = state.current_source || null;
        
        updateIndicators();
        updateButtons();
        
        if (currentSource) {
            toggleVideo(true);
            videoFeed.src = '/video_feed?t=' + Date.now();
        }
    } catch (error) {
        console.log('Sin estado inicial disponible');
    }
    
    // Inicializar estados
    resetEPP();
    
    // Iniciar polling
    setInterval(pollStatus, 1000);
    
    // Mensaje de bienvenida
    setTimeout(() => {
        showNotification('Sistema EPP iniciado', 'success');
        logActivity('success', 'Sistema iniciado');
    }, 1000);
    
    console.log('✅ Sistema EPP listo');
    console.log('⌨️ Shortcuts: 1-6, ESC para reiniciar');
});

// Añadir animación flash
const style = document.createElement('style');
style.textContent = `
    @keyframes flash {
        0% { opacity: 0; }
        50% { opacity: 1; }
        100% { opacity: 0; }
    }
`;
document.head.appendChild(style);

// Exponer funciones para debugging
window.eppSystem = {
    updateEPPStatus,
    showNotification,
    logActivity,
    resetEPP,
    get detectionActive() { return detectionActive; },
    get recognitionActive() { return recognitionActive; },
    get currentSource() { return currentSource; }
};
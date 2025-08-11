// ====== VARIABLES GLOBALES ======
let detectionActive = false;
let recognitionActive = false;
let currentSource = null;
let streamActive = false;
let systemStartTime = new Date();
let detectionCount = {
    total: 0,
    complete: 0,
    incidents: 0
};

// Referencias a elementos DOM
const videoFeed = document.getElementById('videoFeed');
const placeholder = document.getElementById('placeholder');
const fileInput = document.getElementById('fileInput');

// Estados EPP (solo 4 elementos)
const eppElements = {
    casco: document.getElementById('statusCasco'),
    gafas: document.getElementById('statusGafas'),
    chaleco: document.getElementById('statusChaleco'),
    guantes: document.getElementById('statusGuantes')
};

// Indicadores de estado
const detectionIndicator = document.getElementById('detectionIndicator');
const recognitionIndicator = document.getElementById('recognitionIndicator');
const cameraStatus = document.getElementById('cameraStatus');

// Elementos del gráfico circular
const progressCircle = document.getElementById('progressCircle');
const progressText = document.getElementById('progressText');

// Elementos de información
const detectionIcon = document.getElementById('detectionIcon');
const detectionText = document.getElementById('detectionText');
const detectionTime = document.getElementById('detectionTime');
const activityLog = document.getElementById('activityLog');

// Configuración de mensajes para cada EPP
const eppLabels = {
    casco: { detected: 'CASCO<br>DETECTADO', notDetected: 'CASCO<br>NO DETECTADO' },
    gafas: { detected: 'GAFAS<br>DETECTADAS', notDetected: 'GAFAS<br>NO DETECTADAS' },
    chaleco: { detected: 'CHALECO<br>DETECTADO', notDetected: 'CHALECO<br>NO DETECTADO' },
    guantes: { detected: 'GUANTES<br>DETECTADOS', notDetected: 'GUANTES<br>NO DETECTADOS' }
};

// Configuración de endpoints para Flask
const API_ENDPOINTS = {
    uploadFile: '/upload_file',
    openExcel: '/open_excel',
    toggleRecognition: '/toggle_recognition',
    toggleDetection: '/toggle_detection',
    captureFrame: '/capture_frame',
    startCamera: '/start_camera',
    stopCamera: '/stop_camera',
    getDetectionStatus: '/get_detection_status',
    resetSystem: '/reset_system',
    getSystemStats: '/get_system_stats',
    videoFeed: '/video_feed'
};

// ====== FUNCIONES PRINCIPALES ======

/**
 * Actualiza los estados visuales de EPP
 */
function updateEPPStatus(status) {
    let detectedCount = 0;
    const totalEPP = 4; // Solo 4 elementos EPP
    
    Object.keys(eppElements).forEach(key => {
        const element = eppElements[key];
        const detected = status[key] || false;
        
        if (element && eppLabels[key]) {
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
    
    // Actualizar gráfico circular
    updateComplianceChart(detectedCount, totalEPP);
    
    // Actualizar información de detección
    updateDetectionInfo(status, detectedCount, totalEPP);
}

/**
 * Actualiza el gráfico circular de cumplimiento
 */
function updateComplianceChart(detected, total) {
    const percentage = Math.round((detected / total) * 100);
    const circumference = 2 * Math.PI * 60; // radio = 60
    const progress = (percentage / 100) * circumference;
    
    progressCircle.style.strokeDasharray = `${progress} ${circumference}`;
    progressText.textContent = `${percentage}%`;
    
    // Cambiar color según el porcentaje
    if (percentage === 100) {
        progressCircle.style.stroke = '#00d084'; // Verde
    } else if (percentage >= 75) {
        progressCircle.style.stroke = '#ff6b35'; // Naranja
    } else {
        progressCircle.style.stroke = '#ff4757'; // Rojo
    }
}

/**
 * Actualiza la información de detección en tiempo real
 */
function updateDetectionInfo(status, detectedCount, totalEPP) {
    const now = new Date();
    const timeString = now.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
    
    if (status.persona) {
        detectionIcon.textContent = '👤';
        
        if (detectedCount === totalEPP) {
            detectionText.textContent = 'Persona con EPP completo';
            detectionTime.textContent = `${timeString} - Registro N${detectionCount.total + 1} guardado`;
            addActivityLog('success', 'Persona con EPP completo detectada');
            detectionCount.complete++;
        } else {
            detectionText.textContent = 'Persona con EPP faltante';
            detectionTime.textContent = `${timeString} - EPP incompleto detectado`;
            addActivityLog('warning', `Persona con EPP faltante (${detectedCount}/${totalEPP} elementos)`);
            detectionCount.incidents++;
        }
        
        detectionCount.total++;
    } else {
        detectionIcon.textContent = '👁️';
        detectionText.textContent = 'Esperando detección de persona';
        detectionTime.textContent = `${timeString} - Monitoreando área`;
    }
    
    updateSystemMetrics();
}

/**
 * Añade una entrada al registro de actividad
 */
function addActivityLog(type, message) {
    const now = new Date();
    const timeString = now.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit'
    });
    
    const logItem = document.createElement('div');
    logItem.className = `activity-item ${type}`;
    logItem.innerHTML = `
        <div class="activity-time">${timeString}</div>
        <div class="activity-message">${message}</div>
    `;
    
    activityLog.insertBefore(logItem, activityLog.firstChild);
    
    // Mantener solo las últimas 10 entradas
    while (activityLog.children.length > 10) {
        activityLog.removeChild(activityLog.lastChild);
    }
}

/**
 * Actualiza las métricas del sistema
 */
function updateSystemMetrics() {
    document.getElementById('totalPersons').textContent = detectionCount.total;
    document.getElementById('completeEPP').textContent = detectionCount.complete;
    document.getElementById('incidents').textContent = detectionCount.incidents;
    
    // Calcular tiempo activo
    const activeTime = new Date() - systemStartTime;
    const hours = Math.floor(activeTime / 3600000);
    const minutes = Math.floor((activeTime % 3600000) / 60000);
    const seconds = Math.floor((activeTime % 60000) / 1000);
    document.getElementById('activeTime').textContent = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Actualizar estados del sistema
    document.getElementById('cameraState').textContent = currentSource === 'camera' ? 'Activa' : 'Inactiva';
    document.getElementById('detectionState').textContent = detectionActive ? 'Activa' : 'Inactiva';
    document.getElementById('recognitionState').textContent = recognitionActive ? 'Activo' : 'Inactivo';
}

/**
 * Controla la visibilidad del feed de video vs placeholder
 */
function toggleVideoDisplay(showVideo) {
    if (showVideo) {
        videoFeed.style.display = 'block';
        placeholder.style.display = 'none';
    } else {
        videoFeed.style.display = 'none';
        placeholder.style.display = 'flex';
    }
}

/**
 * Actualiza los indicadores de estado
 */
function updateStatusIndicators() {
    detectionIndicator.classList.toggle('active', detectionActive);
    recognitionIndicator.classList.toggle('active', recognitionActive);
    cameraStatus.classList.toggle('active', currentSource === 'camera');
}

/**
 * Actualiza el estado visual de los botones
 */
function updateButtonStates() {
    document.getElementById('btnDetection').classList.toggle('active', detectionActive);
    document.getElementById('btnRecognition').classList.toggle('active', recognitionActive);
    document.getElementById('btnCamera').classList.toggle('active', currentSource === 'camera');
}

/**
 * Muestra notificaciones al usuario
 */
function showNotification(message, type = 'info', duration = 4000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 400);
    }, duration);
}

/**
 * Resetea todos los estados EPP
 */
function resetEPPStatus() {
    const resetStatus = {
        casco: false,
        gafas: false,
        chaleco: false,
        guantes: false,
        persona: false
    };
    updateEPPStatus(resetStatus);
}

/**
 * Función helper para hacer peticiones a la API Flask
 */
async function apiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(endpoint, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Request Error:', error);
        throw error;
    }
}

/**
 * Función para polling del estado de detección
 */
async function pollDetectionStatus() {
    if (!detectionActive) return;
    
    try {
        const response = await fetch(API_ENDPOINTS.getDetectionStatus);
        const status = await response.json();
        updateEPPStatus(status);
    } catch (error) {
        console.error('Error obteniendo estado de detección:', error);
    }
}

/**
 * Crea efecto visual de flash para captura
 */
function createFlashEffect() {
    const flash = document.createElement('div');
    flash.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(255, 255, 255, 0.8);
        z-index: 9999;
        pointer-events: none;
        animation: flashEffect 0.3s ease-out;
    `;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 300);
}

// ====== EVENT LISTENERS ======

// Dropdown del menú
document.getElementById('menuBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = document.querySelector('.dropdown');
    dropdown.classList.toggle('show');
});

// Cerrar dropdown al hacer clic fuera
document.addEventListener('click', () => {
    const dropdown = document.querySelector('.dropdown');
    dropdown.classList.remove('show');
});

// Opciones del menú
document.getElementById('addPersonBtn').addEventListener('click', () => {
    showNotification('Funcionalidad "Agregar Persona" en desarrollo', 'info');
});

document.getElementById('viewExcelBtn').addEventListener('click', async () => {
    try {
        const response = await fetch(API_ENDPOINTS.openExcel);
        const result = await response.json();
        
        if (result.success) {
            showNotification('Registro de asistencia abierto', 'success');
            addActivityLog('info', 'Archivo de registros abierto');
        } else {
            showNotification('Error abriendo registros', 'error');
        }
    } catch (error) {
        showNotification('Error de conexión', 'error');
    }
});

document.getElementById('exportDataBtn').addEventListener('click', () => {
    showNotification('Funcionalidad de exportación en desarrollo', 'info');
});

// Botón de refrescar
document.getElementById('refreshBtn').addEventListener('click', async () => {
    showNotification('Refrescando aplicación...', 'info');
    
    try {
        await fetch(API_ENDPOINTS.resetSystem, { method: 'POST' });
        location.reload();
    } catch (error) {
        showNotification('Error al refrescar', 'error');
    }
});

// Botón 1: Cargar archivo
document.getElementById('btnLoad').addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(API_ENDPOINTS.uploadFile, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentSource = result.type;
            
            if (result.type === 'image') {
                videoFeed.src = result.url;
                toggleVideoDisplay(true);
                
                setTimeout(() => {
                    if (detectionActive) {
                        pollDetectionStatus();
                    }
                }, 1000);
                
            } else {
                videoFeed.src = API_ENDPOINTS.videoFeed + '?t=' + new Date().getTime();
                toggleVideoDisplay(true);
            }
            
            showNotification(`${result.type === 'image' ? 'Imagen' : 'Video'} cargado correctamente`, 'success');
            addActivityLog('info', `${result.type === 'image' ? 'Imagen' : 'Video'} cargado: ${result.filename}`);
            resetEPPStatus();
            updateButtonStates();
            updateStatusIndicators();
            
        } else {
            showNotification(result.error || 'Error cargando archivo', 'error');
        }
    } catch (error) {
        showNotification('Error de conexión al cargar archivo', 'error');
        console.error('Error:', error);
    }
});

// Botón 2: Abrir Excel
document.getElementById('btnExcel').addEventListener('click', async () => {
    try {
        const response = await fetch(API_ENDPOINTS.openExcel);
        const result = await response.json();
        
        if (result.success) {
            showNotification('Registro de asistencia abierto', 'success');
            addActivityLog('info', 'Registro de asistencia consultado');
        } else {
            showNotification(result.error || 'Error abriendo Excel', 'error');
        }
    } catch (error) {
        showNotification('Error abriendo registro', 'error');
        console.error('Error:', error);
    }
});

// Botón 3: Reconocimiento facial
document.getElementById('btnRecognition').addEventListener('click', async () => {
    try {
        const response = await fetch(API_ENDPOINTS.toggleRecognition, {
            method: 'POST'
        });
        const result = await response.json();
        
        recognitionActive = result.active;
        updateStatusIndicators();
        updateButtonStates();
        
        showNotification(
            `Reconocimiento facial ${recognitionActive ? 'activado' : 'desactivado'}`, 
            recognitionActive ? 'success' : 'info'
        );
        
        addActivityLog('info', `Reconocimiento facial ${recognitionActive ? 'activado' : 'desactivado'}`);
        
    } catch (error) {
        showNotification('Error activando reconocimiento facial', 'error');
        console.error('Error:', error);
    }
});

// Botón 4: Detección EPP
document.getElementById('btnDetection').addEventListener('click', async () => {
    try {
        const response = await fetch(API_ENDPOINTS.toggleDetection, {
            method: 'POST'
        });
        const result = await response.json();
        
        detectionActive = result.active;
        updateStatusIndicators();
        updateButtonStates();
        
        showNotification(
            `Detección EPP ${detectionActive ? 'activada' : 'desactivada'}`, 
            detectionActive ? 'success' : 'info'
        );
        
        addActivityLog('info', `Detección EPP ${detectionActive ? 'activada' : 'desactivada'}`);
        
        if (!detectionActive) {
            resetEPPStatus();
        }
        
    } catch (error) {
        showNotification('Error activando detección EPP', 'error');
        console.error('Error:', error);
    }
});

// Botón 5: Capturar imagen
document.getElementById('btnCapture').addEventListener('click', async () => {
    if (!currentSource) {
        showNotification('No hay fuente activa para capturar', 'error');
        return;
    }

    try {
        const response = await fetch(API_ENDPOINTS.captureFrame, {
            method: 'POST'
        });
        const result = await response.json();
        
        if (result.success) {
            showNotification(`Imagen capturada: ${result.filename}`, 'success');
            addActivityLog('success', `Captura guardada: ${result.filename}`);
            createFlashEffect();
        } else {
            showNotification(result.error || 'Error capturando imagen', 'error');
        }
    } catch (error) {
        showNotification('Error de conexión al capturar', 'error');
        console.error('Error:', error);
    }
});

// Botón 6: Activar/Desactivar cámara
document.getElementById('btnCamera').addEventListener('click', async () => {
    try {
        if (currentSource === 'camera') {
            const response = await fetch(API_ENDPOINTS.stopCamera, {
                method: 'POST'
            });
            const result = await response.json();
            
            if (result.success) {
                currentSource = null;
                toggleVideoDisplay(false);
                showNotification('Cámara desactivada', 'info');
                addActivityLog('info', 'Cámara desactivada');
            }
        } else {
            const response = await fetch(API_ENDPOINTS.startCamera, {
                method: 'POST'
            });
            const result = await response.json();
            
            if (result.success) {
                currentSource = 'camera';
                videoFeed.src = API_ENDPOINTS.videoFeed + '?t=' + new Date().getTime();
                toggleVideoDisplay(true);
                showNotification('Cámara activada', 'success');
                addActivityLog('success', 'Cámara activada correctamente');
                resetEPPStatus();
            } else {
                showNotification(result.error || 'Error activando cámara', 'error');
            }
        }
        
        updateButtonStates();
        updateStatusIndicators();
        
    } catch (error) {
        showNotification('Error con la cámara', 'error');
        console.error('Error:', error);
    }
});

// ====== MANEJO DE ERRORES DE VIDEO ======

videoFeed.addEventListener('error', () => {
    console.log('Error cargando stream de video');
    toggleVideoDisplay(false);
    currentSource = null;
    updateButtonStates();
    updateStatusIndicators();
    showNotification('Error en el stream de video', 'error');
});

videoFeed.addEventListener('load', () => {
    console.log('Stream de video cargado correctamente');
});

// ====== FUNCIONES DE INICIALIZACIÓN ======

/**
 * Obtiene el estado inicial de la aplicación
 */
async function getInitialState() {
    try {
        const response = await fetch('/get_initial_state');
        const state = await response.json();
        
        detectionActive = state.detection_active || false;
        recognitionActive = state.recognition_active || false;
        currentSource = state.current_source || null;
        
        updateStatusIndicators();
        updateButtonStates();
        
        if (currentSource) {
            toggleVideoDisplay(true);
            videoFeed.src = API_ENDPOINTS.videoFeed + '?t=' + new Date().getTime();
        }
        
    } catch (error) {
        console.error('Error obteniendo estado inicial:', error);
    }
}

/**
 * Inicia el polling de estado de detección
 */
function startStatusPolling() {
    setInterval(() => {
        if (detectionActive && currentSource) {
            pollDetectionStatus();
        }
        updateSystemMetrics(); // Actualizar métricas cada segundo
    }, 1000);
}

/**
 * Resetea todo el sistema
 */
async function resetSystem() {
    try {
        await fetch(API_ENDPOINTS.resetSystem, { method: 'POST' });
        
        currentSource = null;
        detectionActive = false;
        recognitionActive = false;
        
        toggleVideoDisplay(false);
        updateStatusIndicators();
        updateButtonStates();
        resetEPPStatus();
        
        // Resetear contadores
        detectionCount = { total: 0, complete: 0, incidents: 0 };
        updateSystemMetrics();
        
        showNotification('Sistema reiniciado correctamente', 'success');
        addActivityLog('info', 'Sistema reiniciado');
    } catch (error) {
        console.error('Error reiniciando sistema:', error);
        showNotification('Error reiniciando sistema', 'error');
    }
}

// ====== MANEJO DE TECLADO ======

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    
    switch(e.key) {
        case '1':
            document.getElementById('btnLoad').click();
            break;
        case '2':
            document.getElementById('btnExcel').click();
            break;
        case '3':
            document.getElementById('btnRecognition').click();
            break;
        case '4':
            document.getElementById('btnDetection').click();
            break;
        case '5':
            document.getElementById('btnCapture').click();
            break;
        case '6':
            document.getElementById('btnCamera').click();
            break;
        case 'Escape':
            resetSystem();
            break;
        case 'r':
        case 'R':
            if (e.ctrlKey) {
                e.preventDefault();
                document.getElementById('refreshBtn').click();
            }
            break;
    }
});

// ====== MANEJO DE REDIMENSIONAMIENTO ======

window.addEventListener('resize', () => {
    const isMobile = window.innerWidth <= 1024;
    document.body.classList.toggle('mobile-view', isMobile);
});

// ====== INICIALIZACIÓN DE LA APLICACIÓN ======

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🛡️ Iniciando Sistema EPP Corporativo...');
    
    // Obtener estado inicial del servidor
    await getInitialState();
    
    // Inicializar estados visuales
    updateStatusIndicators();
    updateButtonStates();
    resetEPPStatus();
    updateSystemMetrics();
    
    // Iniciar polling de estado
    startStatusPolling();
    
    // Detectar si es móvil
    const isMobile = window.innerWidth <= 1024;
    document.body.classList.toggle('mobile-view', isMobile);
    
    // Mensaje de bienvenida
    setTimeout(() => {
        showNotification('🛡️ Sistema EPP iniciado correctamente', 'success', 5000);
        addActivityLog('success', 'Sistema iniciado correctamente');
    }, 1000);
    
    console.log('✅ Sistema EPP Corporativo cargado');
    console.log('⌨️ Shortcuts: 1-6 para botones, ESC para reset, Ctrl+R para refrescar');
});

// ====== EXPOSICIÓN DE FUNCIONES GLOBALES PARA DEBUGGING ======

window.eppSystem = {
    updateEPPStatus,
    showNotification,
    resetEPPStatus,
    toggleVideoDisplay,
    updateStatusIndicators,
    updateButtonStates,
    updateSystemMetrics,
    apiRequest,
    resetSystem,
    getInitialState,
    addActivityLog,
    API_ENDPOINTS,
    get detectionActive() { return detectionActive; },
    get recognitionActive() { return recognitionActive; },
    get currentSource() { return currentSource; },
    get detectionCount() { return detectionCount; }
};

// ====== AÑADIR ESTILOS DINÁMICOS ======

const style = document.createElement('style');
style.textContent = `
    @keyframes flashEffect {
        0% { opacity: 0; }
        50% { opacity: 1; }
        100% { opacity: 0; }
    }
`;
document.head.appendChild(style);
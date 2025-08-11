// ====== VARIABLES GLOBALES ======
let detectionActive = false;
let recognitionActive = false;
let currentSource = null; // 'camera', 'image', 'video', null
let streamActive = false;

// Referencias a elementos DOM
const videoFeed = document.getElementById('videoFeed');
const placeholder = document.getElementById('placeholder');
const fileInput = document.getElementById('fileInput');

// Estados EPP
const eppElements = {
    casco: document.getElementById('statusCasco'),
    gafas: document.getElementById('statusGafas'),
    chaleco: document.getElementById('statusChaleco'),
    persona: document.getElementById('statusPersona'),
    guantes: document.getElementById('statusGuantes'),
    safe: document.getElementById('statusSafe')
};

// Indicadores de estado
const detectionIndicator = document.getElementById('detectionIndicator');
const recognitionIndicator = document.getElementById('recognitionIndicator');

// Configuración de mensajes para cada EPP
const eppLabels = {
    casco: { detected: 'CASCO<br>DETECTADO', notDetected: 'CASCO<br>NO DETECTADO' },
    gafas: { detected: 'GAFAS<br>DETECTADAS', notDetected: 'GAFAS<br>NO DETECTADAS' },
    chaleco: { detected: 'CHALECO<br>DETECTADO', notDetected: 'CHALECO<br>NO DETECTADO' },
    persona: { detected: 'PERSONA<br>DETECTADA', notDetected: 'PERSONA<br>NO DETECTADA' },
    guantes: { detected: 'GUANTES<br>DETECTADOS', notDetected: 'GUANTES<br>NO DETECTADOS' },
    safe: { detected: 'CUMPLE<br>EPP COMPLETO', notDetected: 'NO CUMPLE<br>EPP FALTANTE' }
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
    videoFeed: '/video_feed'
};

// ====== FUNCIONES PRINCIPALES ======

/**
 * Actualiza los estados visuales de EPP
 */
function updateEPPStatus(status) {
    Object.keys(status).forEach(key => {
        const element = eppElements[key];
        const detected = status[key];
        
        if (element && eppLabels[key]) {
            const textElement = element.querySelector('.epp-text');
            if (textElement) {
                textElement.innerHTML = detected ? eppLabels[key].detected : eppLabels[key].notDetected;
            }
            
            // Añadir/quitar clase de detección con animación suave
            if (detected) {
                element.classList.add('detected');
            } else {
                element.classList.remove('detected');
            }
        }
    });
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
 * Actualiza los indicadores de estado (puntos de color)
 */
function updateStatusIndicators() {
    detectionIndicator.classList.toggle('active', detectionActive);
    recognitionIndicator.classList.toggle('active', recognitionActive);
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
function showNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Mostrar con animación
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Ocultar y remover
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
        persona: false,
        guantes: false,
        safe: false
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
    if (!detectionActive || !currentSource) return;
    
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
            
            // Si es imagen, mostrar directamente sin usar el stream
            if (result.type === 'image') {
                videoFeed.src = result.url;
                toggleVideoDisplay(true);
                
                // Para imágenes, el frame se procesa en el backend
                // Solo necesitamos mostrar la imagen y actualizar estados periódicamente
                setTimeout(() => {
                    if (detectionActive) {
                        pollDetectionStatus();
                    }
                }, 1000);
                
            } else {
                // Para videos, usar el stream
                videoFeed.src = API_ENDPOINTS.videoFeed + '?t=' + new Date().getTime();
                toggleVideoDisplay(true);
            }
            
            showNotification(`${result.type === 'image' ? 'Imagen' : 'Video'} cargado correctamente`, 'success');
            resetEPPStatus();
            updateButtonStates();
            
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
        
        // Si se desactiva la detección, resetear estados EPP
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
            // Desactivar cámara
            const response = await fetch(API_ENDPOINTS.stopCamera, {
                method: 'POST'
            });
            const result = await response.json();
            
            if (result.success) {
                currentSource = null;
                toggleVideoDisplay(false);
                showNotification('Cámara desactivada', 'info');
            }
        } else {
            // Activar cámara
            const response = await fetch(API_ENDPOINTS.startCamera, {
                method: 'POST'
            });
            const result = await response.json();
            
            if (result.success) {
                currentSource = 'camera';
                videoFeed.src = API_ENDPOINTS.videoFeed + '?t=' + new Date().getTime(); // Cache busting
                toggleVideoDisplay(true);
                showNotification('Cámara activada', 'success');
                resetEPPStatus();
            } else {
                showNotification(result.error || 'Error activando cámara', 'error');
            }
        }
        
        updateButtonStates();
        
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
    showNotification('Error en el stream de video', 'error');
});

videoFeed.addEventListener('load', () => {
    console.log('Stream de video cargado correctamente');
});

// ====== FUNCIONES DE INICIALIZACIÓN ======

/**
 * Crea partículas animadas de fondo
 */
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    const particleCount = 50;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 6 + 's';
        particle.style.animationDuration = (Math.random() * 3 + 3) + 's';
        particlesContainer.appendChild(particle);
    }
}

/**
 * Inicia el polling de estado de detección
 */
function startStatusPolling() {
    setInterval(pollDetectionStatus, 500); // Cada 500ms
}

/**
 * Añade tooltips mejorados
 */
function setupTooltips() {
    const tooltipElements = document.querySelectorAll('[title]');
    tooltipElements.forEach(element => {
        element.addEventListener('mouseenter', function(e) {
            const tooltip = document.createElement('div');
            tooltip.className = 'custom-tooltip';
            tooltip.style.cssText = `
                position: absolute;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                z-index: 1001;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.3s ease;
                backdrop-filter: blur(10px);
            `;
            tooltip.textContent = this.title;
            this.title = ''; // Remover title nativo
            
            document.body.appendChild(tooltip);
            
            const rect = this.getBoundingClientRect();
            tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
            tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';
            
            setTimeout(() => tooltip.style.opacity = '1', 100);
            
            this.tooltipElement = tooltip;
        });
        
        element.addEventListener('mouseleave', function() {
            if (this.tooltipElement) {
                this.tooltipElement.style.opacity = '0';
                setTimeout(() => {
                    if (this.tooltipElement) {
                        this.tooltipElement.remove();
                        this.tooltipElement = null;
                    }
                }, 300);
            }
        });
    });
}

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

// ====== MANEJO DE TECLADO ======

document.addEventListener('keydown', (e) => {
    // Evitar shortcuts si se está escribiendo en un input
    if (e.target.tagName === 'INPUT') return;
    
    // Shortcuts de teclado para funcionalidad rápida
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
            // Resetear todo
            resetSystem();
            break;
    }
});

/**
 * Resetea todo el sistema
 */
async function resetSystem() {
    try {
        await fetch('/reset_system', { method: 'POST' });
        
        currentSource = null;
        detectionActive = false;
        recognitionActive = false;
        
        toggleVideoDisplay(false);
        updateStatusIndicators();
        updateButtonStates();
        resetEPPStatus();
        
        showNotification('Sistema reiniciado', 'info');
    } catch (error) {
        console.error('Error reiniciando sistema:', error);
        showNotification('Error reiniciando sistema', 'error');
    }
}

// ====== MANEJO DE REDIMENSIONAMIENTO ======

window.addEventListener('resize', () => {
    const isMobile = window.innerWidth <= 768;
    document.body.classList.toggle('mobile-view', isMobile);
});

// ====== MANEJO DE VISIBILIDAD DE PÁGINA ======

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Pausar polling cuando la página no es visible
        console.log('Página oculta, pausando polling...');
    } else {
        // Reanudar polling cuando la página es visible
        console.log('Página visible, reanudando polling...');
        if (detectionActive && currentSource) {
            pollDetectionStatus();
        }
    }
});

// ====== INICIALIZACIÓN DE LA APLICACIÓN ======

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🛡️ Iniciando Sistema EPP...');
    
    // Crear efectos visuales
    createParticles();
    setupTooltips();
    
    // Obtener estado inicial del servidor
    await getInitialState();
    
    // Inicializar estados visuales
    updateStatusIndicators();
    updateButtonStates();
    resetEPPStatus();
    
    // Iniciar polling de estado
    startStatusPolling();
    
    // Detectar si es móvil
    const isMobile = window.innerWidth <= 768;
    document.body.classList.toggle('mobile-view', isMobile);
    
    // Mensaje de bienvenida
    setTimeout(() => {
        showNotification('🛡️ Sistema EPP iniciado correctamente', 'success', 4000);
    }, 1000);
    
    console.log('✅ Sistema EPP cargado correctamente');
    console.log('💡 Usa eppSystem en la consola para debugging');
    console.log('⌨️ Shortcuts: 1-6 para botones, ESC para resetear');
});

// ====== EXPOSICIÓN DE FUNCIONES GLOBALES PARA DEBUGGING ======

window.eppSystem = {
    updateEPPStatus,
    showNotification,
    resetEPPStatus,
    toggleVideoDisplay,
    updateStatusIndicators,
    updateButtonStates,
    apiRequest,
    resetSystem,
    getInitialState,
    API_ENDPOINTS,
    // Estados actuales
    get detectionActive() { return detectionActive; },
    get recognitionActive() { return recognitionActive; },
    get currentSource() { return currentSource; }
};
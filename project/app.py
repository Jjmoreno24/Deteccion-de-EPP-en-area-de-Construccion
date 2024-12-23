from flask import Flask, render_template, Response, request, jsonify, send_from_directory
import cv2
import os
from datetime import datetime
from ultralytics import YOLO

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Variables globales
cap = None
source_type = None  # 'video' o 'camera'
img_original = None
deteccion_activa = False

# Inicializa el modelo YOLO con validación
try:
    model = YOLO('best6.pt')
    print("Clases del modelo:", model.names)  # Aquí imprimes las clases del modelo
    print("Modelo YOLO cargado exitosamente.")
except Exception as e:
    print(f"Error al cargar el modelo YOLO: {e}")
    model = None  # Configura el modelo como None para evitar errores posteriores

class_mapping = {
    'casco': 'Casco',
    'sin casco': 'Sin Casco',
    'chaleco': 'Chaleco',
    'sin chaleco': 'Sin Chaleco',
    'gafas': 'Gafas',
    'sin gafas': 'Sin Gafas',
    'guante': 'Guantes',
    'persona': 'Persona'
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/cargar_archivo', methods=['POST'])
def cargar_archivo():
    global img_original, cap, source_type
    if 'file' not in request.files:
        return jsonify({"error": "No se envió ningún archivo"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No se seleccionó ningún archivo"}), 400

    filepath = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
    file.save(filepath)

    # Diferenciar entre imágenes y videos
    if filepath.lower().endswith(('.jpg', '.jpeg', '.png')):
        img_original = cv2.imread(filepath)
        source_type = 'image'
        return jsonify({
            "status": "Imagen cargada correctamente",
            "type": "image",
            "path": f"/uploads/{file.filename}"
        })
    elif filepath.lower().endswith(('.mp4', '.avi')):
        if cap is not None:
            cap.release()  # Libera cualquier fuente previa
        cap = cv2.VideoCapture(filepath)
        source_type = 'video'
        if not cap.isOpened():
            return jsonify({"error": "No se pudo cargar el video"}), 500
        return jsonify({
            "status": "Video cargado correctamente",
            "type": "video",
            "path": f"/uploads/{file.filename}"
        })
    else:
        return jsonify({"error": "Formato de archivo no soportado"}), 400

@app.route('/activar_camara', methods=['POST'])
def activar_camara():
    global cap, source_type
    if cap is not None:
        cap.release()  # Libera cualquier fuente previa
    cap = cv2.VideoCapture(0)  # Cámara predeterminada
    source_type = 'camera'
    if not cap.isOpened():
        return jsonify({"error": "No se pudo activar la cámara"}), 500
    return jsonify({"status": "Cámara activada correctamente"})

@app.route('/activar_deteccion', methods=['POST'])
def activar_deteccion():
    global deteccion_activa
    deteccion_activa = not deteccion_activa
    estado = "activada" if deteccion_activa else "desactivada"
    print(f"Detección {estado}")
    return jsonify({"status": f"Detección {estado}"})

def procesar_frame(frame):
    if not deteccion_activa:
        print("La detección no está activa.")
        return frame  # Devuelve el frame sin modificar

    if model is None:
        print("El modelo YOLO no está disponible.")
        return frame

    print("Procesando frame con YOLO...")
    results = model(frame, conf=0.25)
    for result in results:
        if hasattr(result, 'boxes') and result.boxes:
            print(f"Detecciones encontradas: {len(result.boxes)}")
            for box in result.boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                class_id = int(box.cls[0].item())
                confidence = box.conf[0].item()

                # Dibujar las cajas
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                label = model.names[class_id] if class_id in range(len(model.names)) else "Desconocido"
                cv2.putText(frame, f"{label} ({confidence:.2f})", (x1, y1 - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
        else:
            print("No se detectaron objetos en el frame.")
    return frame

@app.route('/video_feed')
def video_feed():
    def generar_frames():
        global cap, source_type
        if cap is None or source_type != 'video':
            return  # Si no hay video cargado, no genera frames

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                print("Fin del video o error al leer frame.")
                break

            # Procesar el frame con detecciones activadas
            processed_frame = procesar_frame(frame)

            # Codificar el frame para enviarlo al navegador
            _, buffer = cv2.imencode('.jpg', processed_frame)
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')

        cap.release()  # Libera el recurso cuando termina el video
        cap = None

    return Response(generar_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/procesar_imagen', methods=['POST'])
def procesar_imagen():
    global img_original
    if img_original is not None:
        procesada = procesar_frame(img_original.copy())
        filename = f"processed_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        cv2.imwrite(filepath, procesada)
        return jsonify({"status": "Imagen procesada", "path": f"/uploads/{filename}"})
    return jsonify({"error": "No hay imagen cargada"}), 400

if __name__ == '__main__':
    app.run(debug=True)

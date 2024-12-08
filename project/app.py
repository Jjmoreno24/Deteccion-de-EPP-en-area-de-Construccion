from flask import Flask, render_template, Response, request, jsonify, send_from_directory
import cv2
import os
from datetime import datetime

# Configuración de la aplicación Flask
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)  # Crea la carpeta de subida si no existe

cap = None
img_original = None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    # Sirve los archivos de la carpeta 'uploads'
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/cargar_archivo', methods=['POST'])
def cargar_archivo():
    try:
        global img_original, cap
        if 'file' not in request.files:
            return jsonify({"error": "No se envió ningún archivo"}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No se seleccionó ningún archivo"}), 400

        filepath = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
        file.save(filepath)  # Guarda el archivo en la carpeta 'uploads'

        # Verifica el tipo de archivo
        if filepath.lower().endswith(('.jpg', '.jpeg', '.png')):
            img_original = cv2.imread(filepath)
            return jsonify({
                "status": "Imagen cargada correctamente",
                "type": "image",
                "path": f"/uploads/{file.filename}"
            })
        elif filepath.lower().endswith(('.mp4', '.avi')):
            cap = cv2.VideoCapture(filepath)
            return jsonify({
                "status": "Video cargado correctamente",
                "type": "video",
                "path": f"/uploads/{file.filename}"
            })
        else:
            return jsonify({"error": "Formato de archivo no soportado"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
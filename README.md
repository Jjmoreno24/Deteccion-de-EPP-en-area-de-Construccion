# Detección de EPP y Reconocimiento Facial con YOLO y OpenCV

![Python](https://img.shields.io/badge/Python-3.10-blue?style=for-the-badge&logo=python)  ![OpenCV](https://img.shields.io/badge/OpenCV-4.5.5-green?style=for-the-badge&logo=opencv) ![YOLO](https://img.shields.io/badge/YOLO-Detection-orange?style=for-the-badge&logo=yolo) ![Tkinter](https://img.shields.io/badge/Tkinter-GUI-red?style=for-the-badge)

## Descripción

Este proyecto implementa un sistema de detección de **Equipo de Protección Personal (EPP)** y **reconocimiento facial** en tiempo real, utilizando **YOLOv11**, **OpenCV** y **Tkinter**. Permite analizar imágenes y videos para verificar el uso de casco, gafas, chaleco, guantes y la presencia de personas en el entorno. Además, registra los rostros detectados en un archivo Excel para llevar un control de accesos.

El sistema puede operar con **cámara en vivo** o **archivos de imagen y video**, mostrando visualmente los resultados mediante una interfaz de usuario interactiva.

## Desarrollo

### Herramientas y Tecnologías Utilizadas
- **Lenguaje:** Python 3.10
- **Frameworks/Librerías:** OpenCV, Tkinter, NumPy, face_recognition, PIL, OpenPyXL
- **Modelo de Detección:** YOLOv11 (best6.pt)
- **Interfaz Gráfica:** Tkinter
- **Almacenamiento de Registros:** Archivo Excel (OpenPyXL)

### Características Principales

- **Detección de EPP**: Identifica el uso de casco, gafas, chaleco, guantes y la presencia de personas.
- **Reconocimiento Facial**: Compara los rostros detectados con una base de datos de imágenes predefinida.
- **Interfaz Gráfica**: Panel de control en Tkinter para cargar imágenes, activar cámara y visualizar resultados.
- **Registro de Horarios**: Almacena en un archivo Excel la fecha y hora de detección de cada persona identificada.

## Implementación

### Carga y Procesamiento de Imágenes

Las imágenes se cargan desde un directorio predefinido y se convierten a RGB para su procesamiento con la librería **face_recognition**. Se generan codificaciones faciales para permitir la comparación en tiempo real.

```python
for archivo in lista:
    imgdb = cv2.imread(f'{path}/{archivo}')
    images.append(imgdb)
    nombres.append(os.path.splitext(archivo)[0])

def codificar_rostros(images):
    lista_codificaciones = []
    for img in images:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        codificacion = fr.face_encodings(img)[0]
        lista_codificaciones.append(codificacion)
    return lista_codificaciones
```

### Detección de EPP

El modelo YOLOv11 se utiliza para detectar el equipo de protección personal en la imagen o video. Se emplea un diccionario de clases y colores aleatorios para etiquetar cada objeto detectado en el frame.

```python
def dibujar_cajas(img, results):
    for result in results:
        if hasattr(result, 'boxes'):
            for box in result.boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                class_id = int(box.cls[0].item())
                confidence = box.conf[0].item()
                class_name = model.names[class_id] if class_id in range(len(model.names)) else "Desconocido"
                label = class_mapping.get(class_name, "Desconocido")
                color = get_color_for_class(class_name)
                cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
                cv2.putText(img, f"{label} ({confidence:.2f})", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
    return img
```

### Registro de Horarios en Excel

Cada vez que se detecta un rostro conocido, el sistema almacena la fecha y hora en un archivo Excel (`Horario.xlsx`) para llevar un control de asistencia o verificación de uso de EPP.

```python
def horario(nombre):
    archivo_excel = "Horario.xlsx"
    if not os.path.exists(archivo_excel):
        wb = Workbook()
        ws = wb.active
        ws.append(["Nombre", "Fecha", "Hora"])
        wb.save(archivo_excel)
    wb = load_workbook(archivo_excel)
    ws = wb.active
    fecha_actual = datetime.now().strftime('%Y-%m-%d')
    for fila in ws.iter_rows(min_row=2, values_only=True):
        if fila[0] == nombre and fila[1] == fecha_actual:
            return
    hora_actual = datetime.now().strftime('%H:%M:%S')
    ws.append([nombre, fecha_actual, hora_actual])
    wb.save(archivo_excel)
```

## 🔭 Vista - Ejecución

<p align="center">
  <a href="https://www.youtube.com/watch?v=_plYc9kN0sY">
    <img src="https://github.com/Jjmoreno24/Deteccion-de-EPP-en-area-de-Construccion/blob/8e8f4245ec47cfbfe79ac9b1dc548f87efccf985/Captura%20de%20pantalla%202025-02-19%20143809.png" alt="Video de demostración" width="600">
  </a>
</p>

<div align="center">
<h3 align="center">Contacto 😋</h3>
</div>
<p align="center">
<a href="https://www.linkedin.com/in/jjosemoreno24" target="blank">
<img align="center" width="30px" alt="Hector's LinkedIn" src="https://www.vectorlogo.zone/logos/linkedin/linkedin-icon.svg"/></a> &nbsp; &nbsp;
<a href="https://twitter.com" target="blank">
<img align="center" width="30px" alt="Hector's Twitter" src="https://www.vectorlogo.zone/logos/twitter/twitter-official.svg"/></a> &nbsp; &nbsp;
<a href="https://www.twitch.tv" target="blank">
<img align="center" width="30px" alt="Hector's Twitch" src="https://www.vectorlogo.zone/logos/twitch/twitch-icon.svg"/></a> &nbsp; &nbsp;
<a href="https://www.youtube.com" target="blank">
<img align="center" width="30px" alt="Hector's Youtube" src="https://www.vectorlogo.zone/logos/youtube/youtube-icon.svg"/></a> &nbsp; &nbsp;
</p>

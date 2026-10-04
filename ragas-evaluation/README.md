# Evaluación RAGAS (TF-174)

Script standalone de evaluacion de calidad de las respuestas generadas por M4, usando RAGAS (faithfulness, answer_relevancy). No forma parte del pipeline en producción, no se despliega en Railway, no escribe nada en la base real. Se debe ejecutar a mano, genera un reporte JSON local.

## Setup

```
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Creá un archivo `.env` en esta carpeta con:

```
DATABASE_URL=<la misma connection string del Session Pooler que usa backend/.env>
OPENAI_API_KEY=<tu api key de OpenAI>
```

## Uso

```
source venv/bin/activate
python evaluate_response_quality.py
```

Ajustá `SAMPLE_SIZE` dentro del script para controlar cuántas interacciones reales se evalúan. Cada caso hace dos llamadas reales a OpenAI (una por métrica), así que el costo escala con el tamaño de la muestra.

## Nota sobre dependencias

`ragas==0.4.3` requiere `langchain-community<0.4.2` fijado explícitamente. Versiones más nuevas de `langchain-community` eliminaron un módulo (`chat_models.vertexai`) que `ragas` sigue importando sin condicional, rompiendo con `ModuleNotFoundError` al cargar la librería. Es un bug conocido de `ragas`, no de este proyecto. `requirements.txt` ya fija la combinación que funciona.
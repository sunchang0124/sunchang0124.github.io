FROM python:3.6.9-slim-stretch

RUN apt-get update && apt-get install -y python-pip

RUN mkdir /data

COPY run.py run.py

RUN pip install 'pandas==0.25.1'

CMD ["python", "run.py"]

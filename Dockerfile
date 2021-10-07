FROM node:16
WORKDIR /usr/src/app

COPY app/package*.json ./
RUN npm install

COPY app/src/ .

EXPOSE 8090
CMD [ "node", "index.js" ]

const express = require('express');
const http = require('http');
const logger = require('./libs/log'); // логирование в консоль
const morgan = require('morgan'); // логирование запросов с клиента в консоль
const bodyParser = require('body-parser');
const path = require('path');
const createData = require('./libs/create-data.js');
const Emitter = require("events");
const renderPdf = require('./libs/render-pdf.js');
const removeFile = require('./libs/remove-file.js');
const changeImages = require('./libs/change-images.js');
const createStatistics = require('./libs/create-statistics.js');
const saveToTxt = require('./libs/save-to-txt.js');

const app = express();
app.set('port', 3000);
app.set('views', path.join(__dirname, 'pdf.html'));
app.set('view engine', 'ejs');
app.use(morgan('tiny')); // логирование запросов с клиента в консоль
app.use(bodyParser.json());
var emitter = new Emitter();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Credentials', true);
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
  next();
});

let isPanding = false;
let notCreatePDF = false;

app.post('/application', (req, res) => {
  if (isPanding) {
    res.json({ isPanding: true });
    return;
  }
  isPanding = true;
  notCreatePDF = req.body.notCreatePDF;
  emitter.emit('reguestData', req.body);
  const onResponse = (responseData) => {
    console.log(isPanding);
    res.json(responseData);
    emitter.removeListener('responseData', onResponse);
  }
  emitter.on('responseData', onResponse);
});



let lastFileNamePath = '';
let botrixData = null;

app.post('/bitrix', (req, res) => {
  const onRequest = (reguestData) => {
    console.log(reguestData);
    res.json(reguestData);
    emitter.removeListener('reguestData', onRequest);
  }
  emitter.on('reguestData', onRequest);

  if (req.body.empty) {
    emitter.emit('responseData', {});
    isPanding = false;
    return;
  }
  createData({ req, emitter })
    .then((data) => {
      botrixData = data;
      return removeFile({ path: lastFileNamePath });
    })
    .then(() => {
      if (notCreatePDF) {
        return '';
      }
      return renderPdf(botrixData);
    })
    .then((fileName) => {
      lastFileNamePath = fileName;
      isPanding = false;
    })
});

app.post('/statistics', (req, res) => {
  const statistics = createStatistics(req.body);
  saveToTxt({ path: 'Статистика.txt', text: statistics })
    .then(() => {
      res.json({});
    })
    .catch((e) => {
      console.log(e);
    })
});


app.put('/img', (req, res) => {

  changeImages(req.body)
    .then(() => {
      res.json({});
    })
    .catch((e) => {
      console.log(e);
      res.status(500);
      res.json({});
    });
});



app.use(express.static('templates'));


http.createServer(app).listen(3000, () => {
  logger.info('Express server listening on port ' + 3000);
});

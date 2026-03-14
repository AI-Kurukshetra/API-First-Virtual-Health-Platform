const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { apiPrefix, corsOrigin, nodeEnv } = require('./config/env');
const authRoutes = require('./api/routes/authRoutes');
const appointmentRoutes = require('./api/routes/appointmentRoutes');
const consultationRoutes = require('./api/routes/consultationRoutes');
const patientRoutes = require('./api/routes/patientRoutes');
const prescriptionRoutes = require('./api/routes/prescriptionRoutes');
const paymentRoutes = require('./api/routes/paymentRoutes');
const videoVisitRoutes = require('./api/routes/videoVisitRoutes');
const errorHandler = require('./api/middlewares/errorHandler');

const app = express();

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(nodeEnv === 'production' ? 'combined' : 'dev'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/appointments`, appointmentRoutes);
app.use(`${apiPrefix}/consultations`, consultationRoutes);
app.use(`${apiPrefix}/patients`, patientRoutes);
app.use(`${apiPrefix}/prescriptions`, prescriptionRoutes);
app.use(`${apiPrefix}/payments`, paymentRoutes);
app.use(`${apiPrefix}/video-visits`, videoVisitRoutes);

app.use(errorHandler);

module.exports = app;

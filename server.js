const connectDb = require('./config/db');

process.on('uncaughtException', (err) => {
  console.log('uncaught exception, shutting down ....');
  console.log(err.message);
}); // this handler should be in the top to catch exceptions;

const app = require('./app');

// Connect to the database
connectDb();

// Start the server
const port = process.env.PORT || 8000;
const server = app.listen(port, () =>
  console.log(`Server running on port: ${port}`),
);

// Handle unhandled promise rejections
// like database connection rejection
process.on('unhandledRejection', (err) => {
  console.log('Unhandled Rejection: Shutting down...');
  console.log(err.stack || err.message);
  server.close(() => process.exit(1));
});

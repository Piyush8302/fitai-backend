const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err.message);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Server Error';

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Resource not found';
  }

  // Mongoose duplicate key → friendly
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || { field: '' })[0];
    const labels = { email: 'This email', phone: 'This phone number' };
    message = `${labels[field] || field} is already registered`;
  }

  // Mongoose validation error → plain-English messages
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map(e => {
      if (e.kind === 'minlength' && e.path === 'password') return 'Password must be at least 6 characters';
      if (e.kind === 'minlength') return `${e.path} is too short`;
      if (e.kind === 'required') return `${e.path} is required`;
      if (e.kind === 'enum') return `Invalid ${e.path}`;
      return e.message;
    }).join(', ');
  }

  // JWT / auth errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Session expired. Please login again.';
  }

  // Never send an empty/undefined/raw message to the user
  if (!message || message === 'undefined' || statusCode === 500) {
    message = statusCode === 500 ? 'Something went wrong. Please try again.' : message;
  }

  res.status(statusCode).json({ success: false, message });
};

module.exports = errorHandler;

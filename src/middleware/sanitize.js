// Strip MongoDB operators from anything a client sends.
//
// Every public auth route passed request fields straight into a query —
// `User.findOne({ phone })`. Send `{"phone": {"$ne": null}}` and that matches the
// first user with any phone at all, and verify-otp handed back their token.
// Proven on staging before this was added.
//
// Removes any key that starts with `$` or contains a `.` (Mongo's path
// separator), at any depth, from body, query and params. Real field values —
// strings, numbers, arrays of those — pass through untouched.

const clean = (value, depth = 0) => {
  if (depth > 20 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => clean(v, depth + 1));
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete value[key];
    } else {
      value[key] = clean(value[key], depth + 1);
    }
  }
  return value;
};

module.exports = (req, res, next) => {
  if (req.body) clean(req.body);
  if (req.params) clean(req.params);
  // req.query is a getter in newer Express; mutate its contents in place.
  if (req.query && typeof req.query === 'object') clean(req.query);
  next();
};

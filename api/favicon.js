export default async function handler(req, res) {
  // 32x32 transparent PNG served as .ico for simplicity
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJ'+
    'bWFnZVJlYWR5ccllPAAAAH5JREFUeNpi/P//PwMlgImBQjDw////x4ABiD8G4qYGBgYGNjY2QGQw'+
    'GJgYGBgY2JiYgBqA8R8QH4YwGgBiCWwYQAxB8QOQ6iEwB0g1gHgUEkAHkGgkGQKQH0C0g0QHQLSDR'+
    'AdAtINEDkGgkGQKQH0C0g0QHQMSAAQYAP8xkq0cF8HkAAAAAElFTkSuQmCC';
  const buf = Buffer.from(base64, 'base64');
  res.setHeader('Content-Type', 'image/x-icon');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.status(200).send(buf);
}

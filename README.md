# Local Drive

### File Structure

```
    LocalDrive/
    │
    ├── src/
    │   ├── app.js
    │   ├── server.js
    │   │
    │   ├── config/
    │   │   ├── index.js
    │   │   └── database.js
    │   │
    │   ├── routes/
    │   │   ├── index.js
    │   │   ├── auth.routes.js
    │   │   └── file.routes.js
    │   │
    │   ├── controllers/
    │   │   ├── auth.controller.js
    │   │   └── file.controller.js
    │   │
    │   ├── services/
    │   │   ├── auth.service.js
    │   │   └── file.service.js
    │   │
    │   ├── repositories/
    │   │   ├── user.repository.js
    │   │   └── file.repository.js
    │   │
    │   ├── models/
    │   │   ├── user.model.js
    │   │   └── file.model.js
    │   │
    │   ├── middlewares/
    │   │   ├── auth.middleware.js
    │   │   └── error.middleware.js
    │   │
    │   ├── storage/
    │   │   └── local.storage.js
    │   │
    │   └── utils/
    │       ├── hash.js
    │       └── jwt.js
    │
    ├── uploads/
    ├── migrations/
    ├── .env
    ├── package.json
    └── README.md`
```
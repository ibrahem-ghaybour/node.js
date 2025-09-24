# Express MongoDB Backend - Project README

This backend provides authentication, products, categories, locations, wishlist, and the following newly added features:

- Cart: Users can add products, update quantities, remove items, clear cart, and checkout.
- Orders: Create orders either from a provided items payload or directly from the user's cart (preferred). Orders clear the cart on success.
- Addresses: Users can save multiple shipping addresses and pass an `addressId` while ordering.
- Stats Dashboard: Admin/Manager can retrieve dashboard KPIs (Total Revenue, Subscriptions, Sales, Active Now, Overview, Recent Sales).

## New Models

- `models/Cart.js`
- `models/Order.js` (enhanced)
- `models/Address.js`

## New/Updated Routes

- Cart: `routes/cart.js`
  - GET `/api/cart` – Get current user's cart
  - POST `/api/cart/add` – Add product to cart (or increase quantity)
  - PATCH `/api/cart/item/:productId` – Set item quantity (0 removes)
  - DELETE `/api/cart/item/:productId` – Remove item
  - DELETE `/api/cart` – Clear cart
  - POST `/api/cart/checkout` – Create an order from the cart and clear it

- Orders: `routes/orders.js`
  - POST `/api/orders`
    - Preferred: Call with no `items` body to auto-use the current user's cart.
    - Optional: Supply `items` array manually.
    - Optional: Provide `addressId` (must belong to the logged-in user) to set `shippingAddress`.
    - Currency is taken from body if provided, else from cart currency, else defaults to `USD`.
    - On success, if created from the cart, the cart is cleared.
  - GET `/api/orders` – List orders (own for users; all for admin/manager)
  - GET `/api/orders/:id` – Get one (owner or admin/manager)
  - PATCH `/api/orders/:id/status` – Update status (admin/manager)
  - POST `/api/orders/:id/cancel` – Cancel (owner; only if `pending`)

- Addresses: `routes/addresses.js`
  - GET `/api/addresses` – List user's addresses
  - GET `/api/addresses/:id` – Get one (must be user's)
  - POST `/api/addresses` – Create
  - PUT `/api/addresses/:id` – Update
  - DELETE `/api/addresses/:id` – Soft delete
  - POST `/api/addresses/:id/default` – Set default address

- Stats: `routes/stats.js`
  - GET `/api/stats/dashboard?range=30d&limit=10` (admin/manager)
    - totalRevenue: Sum of orders with status in [paid, shipped, delivered] within range
    - subscriptions: Count of active users
    - sales: Count of orders with status in [paid, shipped, delivered]
    - activeNow: Users with status `active` and `isActive: true`
    - overview: Daily series of revenue and orders
    - recentSales: Latest N orders with user info

## Server Wiring (server.js)

Registered routes and advertised in root endpoint list:

- `/api/cart`
- `/api/orders`
- `/api/addresses`
- `/api/stats`
- (Existing) `/api/auth`, `/api/users`, `/api/products`, `/api/categories`, `/api/governorates`, `/api/cities`, `/api/wishlist`

## Authentication

All protected endpoints require:

```
Authorization: Bearer <JWT>
```

## Usage Examples

### Cart

- Add to cart

```
POST /api/cart/add
{
  "productId": "<PRODUCT_ID>",
  "quantity": 2
}
```

- View cart: `GET /api/cart`

- Update item quantity

```
PATCH /api/cart/item/<PRODUCT_ID>
{
  "quantity": 3
}
```

- Clear cart: `DELETE /api/cart`

- Checkout from cart: `POST /api/cart/checkout`

### Orders

- Create from cart (no items body)

```
POST /api/orders
{
  "addressId": "<ADDRESS_ID>",
  "notes": "Leave at reception",
  "currency": "USD"
}
```

- Create with explicit items

```
POST /api/orders
{
  "items": [
    { "productId": "<ID1>", "quantity": 2 },
    { "productId": "<ID2>", "quantity": 1 }
  ],
  "addressId": "<ADDRESS_ID>",
  "notes": "Evening delivery",
  "currency": "USD"
}
```

### Addresses

- Create address

```
POST /api/addresses
{
  "fullName": "John Doe",
  "phone": "+20123456789",
  "line1": "123 Main St",
  "line2": "",
  "city": "Cairo",
  "governorate": "Cairo",
  "postalCode": "11511",
  "country": "EG",
  "isDefault": true
}
```

### Stats (Admin/Manager)

```
GET /api/stats/dashboard?range=30d&limit=10
```

## Changelog (What was added)

- Added Cart model and routes.
- Enhanced Orders to create from Cart (and clear cart afterwards) and accept `addressId`.
- Added Address model and routes (CRUD + default).
- Added Stats dashboard endpoint for admin/manager.
- Wired new routes into `server.js` and added to root endpoint listing.

## Conversation Log (original content preserved below)
# Cascade Chat Conversation

  Note: _This is purely the output of the chat conversation and does not contain any raw data, codebase snippets, etc. used to generate the output._

### User Input

I want you to create a card for the user to add their requests to and it will be linked to them according to the ID and I want orders too

### Planner Response

To implement "cards" for user requests linked by user ID and also handle "orders," I’ll first inspect your current Node.js project structure and the open files (`server.js` and `routes/categories.js`) to understand existing patterns (framework, DB, routers). This will help me add consistent models and routes.

*Listed directory [nodeee](file:///d:/nodeee) *

### Planner Response

I’m going to open the key files ([server.js](cci:7://file:///d:/nodeee/server.js:0:0-0:0), existing [routes/](cci:7://file:///d:/nodeee/routes:0:0-0:0) and [models/](cci:7://file:///d:/nodeee/models:0:0-0:0)) to understand the current Express and database setup so I can add consistent `Card` and `Order` models and routes, and wire them into [server.js](cci:7://file:///d:/nodeee/server.js:0:0-0:0). I’ll read them in parallel for speed.

*Viewed [server.js](file:///d:/nodeee/server.js) *

*Listed directory [routes](file:///d:/nodeee/routes) *

*Listed directory [models](file:///d:/nodeee/models) *

*Viewed [categories.js](file:///d:/nodeee/routes/categories.js) *

*Listed directory [middleware](file:///d:/nodeee/middleware) *

*Viewed [User.js](file:///d:/nodeee/models/User.js) *

*Viewed [auth.js](file:///d:/nodeee/middleware/auth.js) *

*Viewed [Product.js](file:///d:/nodeee/models/Product.js) *

*Updated todo list*

### Planner Response

I will open [package.json](cci:7://file:///d:/nodeee/package.json:0:0-0:0) to confirm dependencies like `express-validator` and ensure consistency with the current setup before adding new models and routes.

*Viewed [package.json](file:///d:/nodeee/package.json) *

### Planner Response

I will add new Mongoose models for Request and Order, create corresponding Express routes with validation and access control, and wire them into server.js. First, I'll create the new model files.

*Edited relevant file*

### Planner Response

I will create the `Order` model and two new route files `routes/requests.js` and `routes/orders.js` to handle CRUD and listing, following the existing patterns with [protect](cci:1://file:///d:/nodeee/middleware/auth.js:3:0-46:2), [authorize](cci:1://file:///d:/nodeee/middleware/auth.js:48:0-57:2), and `express-validator`. Then, I'll wire these routes into [server.js](cci:7://file:///d:/nodeee/server.js:0:0-0:0).

*Edited relevant file*

*Edited relevant file*

*Edited relevant file*

### Planner Response

I will wire the new `requests` and `orders` routes into [server.js](cci:7://file:///d:/nodeee/server.js:0:0-0:0) and update the root endpoint to advertise them. This requires editing [d:\nodeee\server.js](cci:7://file:///d:/nodeee/server.js:0:0-0:0).

*Edited relevant file*

*Updated todo list*

### Planner Response

I’ve added backend support for “cards” (user requests) linked to a user by ID, plus a complete orders flow. This includes Mongoose models, protected routes with validation, and wiring into [server.js](cci:7://file:///d:/nodeee/server.js:0:0-0:0).

What I added
- Models (in [models/](cci:7://file:///d:/nodeee/models:0:0-0:0)):
  - [Request.js](cci:7://file:///d:/nodeee/models/Request.js:0:0-0:0): a “card” linked to `user` (ObjectId), with `title`, `description`, `priority`, `status`, and soft-delete via `isActive`. Text index on title/description.
  - [Order.js](cci:7://file:///d:/nodeee/models/Order.js:0:0-0:0): items array containing product info, linked to `user`, with `totalAmount`, `currency`, `status`, `shippingAddress`, `notes`, soft-delete via `isActive`.

- Routes (in [routes/](cci:7://file:///d:/nodeee/routes:0:0-0:0)):
  - [requests.js](cci:7://file:///d:/nodeee/routes/requests.js:0:0-0:0):
    - POST `/api/requests`: Create a request linked to the current user.
    - GET `/api/requests`: List requests (users see their own; admin/manager can see all). Pagination, search, sorting.
    - GET `/api/requests/:id`: Get a request (owner or admin/manager).
    - PUT `/api/requests/:id`: Update. Owner can edit title/description/priority. Only admin/manager can change status.
    - DELETE `/api/requests/:id`: Soft-delete. Owners can delete only when status is `open`; admin/manager can always delete.
  - [orders.js](cci:7://file:///d:/nodeee/routes/orders.js:0:0-0:0):
    - POST `/api/orders`: Create an order for the current user. Calculates totals using current Product data.
    - GET `/api/orders`: List orders (users see their own; admin/manager can see all). Pagination/sorting.
    - GET `/api/orders/:id`: Get an order (owner or admin/manager).
    - PATCH `/api/orders/:id/status`: Update status (admin/manager only).
    - POST `/api/orders/:id/cancel`: Owner can cancel when `pending`.

- Server wiring (in [server.js](cci:7://file:///d:/nodeee/server.js:0:0-0:0)):
  - Added:
    - `app.use("/api/requests", require("./routes/requests"));`
    - `app.use("/api/orders", require("./routes/orders"));`
  - Root index now advertises `requests` and `orders` endpoints.

How to use the APIs
- Auth
  - All routes require JWT auth via `Authorization: Bearer <token>` using the existing [protect](cci:1://file:///d:/nodeee/middleware/auth.js:3:0-46:2) middleware.

- Requests (cards)
  - Create
    - POST `/api/requests`
    - Body:
      {
        "title": "Need assistance with my order",
        "description": "I want to change the shipping address.",
        "priority": "high"
      }
  - List (own by default)
    - GET `/api/requests?page=1&limit=10&status=open&search=address&sortBy=createdAt&sortOrder=desc`
  - Get one
    - GET `/api/requests/:id`
  - Update
    - PUT `/api/requests/:id`
    - Body (owner can change title/description/priority; status requires admin/manager):
      {
        "title": "Updated title",
        "priority": "urgent",
        "status": "in_progress"
      }
  - Delete (soft)
    - DELETE `/api/requests/:id`

- Orders
  - Create
    - POST `/api/orders`
    - Body:
      {
        "items": [
          { "productId": "64f0...abc1", "quantity": 2 },
          { "productId": "64f0...abc2", "quantity": 1 }
        ],
        "shippingAddress": {
          "fullName": "John Doe",
          "phone": "+20123456789",
          "line1": "123 Main St",
          "city": "Cairo",
          "governorate": "Cairo",
          "postalCode": "11511",
          "country": "EG"
        },
        "notes": "Please deliver in the evening",
        "currency": "USD"
      }
  - List (own by default)
    - GET `/api/orders?page=1&limit=10&status=pending&sortBy=createdAt&sortOrder=desc`
  - Get one
    - GET `/api/orders/:id`
  - Update status (admin/manager)
    - PATCH `/api/orders/:id/status`
    - Body:
      { "status": "shipped" }
  - Cancel by owner (pending only)
    - POST `/api/orders/:id/cancel`

Notes and consistency
- Both `Request` and `Order` are linked to users via `user: ObjectId('User')`.
- Validations use `express-validator` like your existing routes (e.g., [routes/categories.js](cci:7://file:///d:/nodeee/routes/categories.js:0:0-0:0)).
- Access control uses existing [protect](cci:1://file:///d:/nodeee/middleware/auth.js:3:0-46:2) and [authorize](cci:1://file:///d:/nodeee/middleware/auth.js:48:0-57:2) middlewares from [middleware/auth.js](cci:7://file:///d:/nodeee/middleware/auth.js:0:0-0:0).
- Soft-deletes are implemented with `isActive`, consistent with `Category` patterns.
- `Order` totals are computed server-side using current `Product` price to avoid trusting client prices.

Would you like any custom fields added?
- For Requests: attachments, category/type, SLA timestamps.
- For Orders: payment method, transaction ID, delivery schedule, coupon/discounts, tax/VAT.

Next steps I recommend
- Test quickly with your existing auth tokens.
- If needed, add indexes (Mongoose will create the schema-defined indexes when applicable; ensure your MongoDB user can create indexes).
- Decide if non-admin request deletions should be allowed beyond the `open` state.
- Add any business rules for stock decrement, payments, and shipping integration.

If you want, I can add Swagger/OpenAPI docs for these endpoints and a couple of Jest tests to smoke-test the validators and access control.

### User Input

I did not say I want a request in the word request. I said I want a cat for the user to add my product to.

*Updated todo list*

*Updated todo list*

### Planner Response

I will add a Cart feature so users can add products to their cart and manage it, and connect it to Orders (checkout). I'll create a `Cart` model and a `routes/cart.js` with endpoints for adding/removing items, viewing the cart, clearing it, and checking out to create an Order. Then, I will wire `/api/cart` into [server.js](cci:7://file:///d:/nodeee/server.js:0:0-0:0) and update the advertised endpoints.

*Edited relevant file*

### Planner Response

I'll create a new route file `routes/cart.js` to manage the user's cart (add items, view, update, remove, clear, and checkout to create an order). Then I'll wire the new `/api/cart` route into [server.js](cci:7://file:///d:/nodeee/server.js:0:0-0:0) and advertise it in the root endpoint.

*Edited relevant file*

### Planner Response

I'll wire the new Cart routes into [server.js](cci:7://file:///d:/nodeee/server.js:0:0-0:0) and add the `/api/cart` endpoint to the root endpoint list so you can use it immediately.

*Edited relevant file*

*Updated todo list*

### Planner Response

Thanks for clarifying — you meant a Cart for users to add products, not a “request”. I’ve implemented a full Cart feature and linked it to Orders for checkout.

What I added
- Models
  - [models/Cart.js](cci:7://file:///d:/nodeee/models/Cart.js:0:0-0:0): Stores a unique cart per user with `items[]`, each item tracks `product`, `name`, `price`, `quantity`, `subtotal`, plus a `totalAmount`.
- Routes
  - [routes/cart.js](cci:7://file:///d:/nodeee/routes/cart.js:0:0-0:0):
    - GET `/api/cart`: Get the current user’s cart.
    - POST `/api/cart/add`: Add a product to the cart or increase its quantity.
    - PATCH `/api/cart/item/:productId`: Set a new quantity; `0` removes the item.
    - DELETE `/api/cart/item/:productId`: Remove an item.
    - DELETE `/api/cart`: Clear the cart.
    - POST `/api/cart/checkout`: Create an `Order` from the cart and clear it.
- Wiring
  - [server.js](cci:7://file:///d:/nodeee/server.js:0:0-0:0): Added `app.use("/api/cart", require("./routes/cart"));` and listed it in the root endpoints.
- Orders already exist
  - The previous `orders` endpoints remain (useful for post-checkout).

How to use
- Auth header required on all endpoints: `Authorization: Bearer <token>`

- Add to cart
  - POST `/api/cart/add`
  - Body:
    {
      "productId": "<PRODUCT_ID>",
      "quantity": 2
    }

- View cart
  - GET `/api/cart`

- Update quantity
  - PATCH `/api/cart/item/<PRODUCT_ID>`
  - Body:
    {
      "quantity": 3
    }

- Remove item
  - DELETE `/api/cart/item/<PRODUCT_ID>`

- Clear cart
  - DELETE `/api/cart`

- Checkout (creates an order and clears cart)
  - POST `/api/cart/checkout`
  - Body (optional fields):
    {
      "shippingAddress": {
        "fullName": "John Doe",
        "phone": "+20123456789",
        "line1": "123 Main St",
        "city": "Cairo",
        "governorate": "Cairo",
        "postalCode": "11511",
        "country": "EG"
      },
      "notes": "Leave with the guard",
      "currency": "USD"
    }

Notes
- Cart recalculates totals server-side; we fetch current `Product` price on add and checkout.
- One cart per user; created automatically when accessed the first time.
- Checkout creates an `Order` using the existing [models/Order.js](cci:7://file:///d:/nodeee/models/Order.js:0:0-0:0) and [routes/orders.js](cci:7://file:///d:/nodeee/routes/orders.js:0:0-0:0).

Do you want me to:
- Remove the “requests” feature I previously added, or keep it?
- Change the default currency, or add stock checks before adding to cart/checkout?

*Viewed [Order.js](file:///d:/nodeee/models/Order.js) *

### User Input

Now I want the Point Details to have Total Revenue, Subscriptions, Sales, Active Now, Overview and Recent Sales.

*Updated todo list*

### Planner Response

To add those “Point Details” as a dashboard, I can expose a stats endpoint (e.g., GET `/api/stats/dashboard`) that returns:
- Total Revenue
- Subscriptions
- Sales
- Active Now
- Overview (time series)
- Recent Sales

Before I implement it, can you confirm these definitions so I match your needs?

- Total Revenue: sum of order totals for which statuses? Options:
  - paid + shipped + delivered (recommended), or
  - all non-cancelled, or
  - a custom set.

- Subscriptions: what counts as a subscription in your system?
  - Total registered users,
  - Users with role = "customer",
  - New users in a period (e.g., last 30 days),
  - Or a separate model you have for subscriptions (we don’t have one currently).

- Sales: number of orders for which statuses?
  - paid + shipped + delivered, or
  - all non-cancelled, or
  - all orders regardless of status.

- Active Now: how do you want to define “active”?
  - Users who were active in the last X minutes (we’d need activity tracking), or
  - Users updated in the last X minutes (`updatedAt` heuristic),
  - Orders placed in the last X minutes,
  - Or users with `status: "active"` (static).

- Overview: time bucket and metric(s)?
  - Revenue per day for the last 30 days,
  - Orders count per day for the last 30 days,
  - Both?

- Recent Sales: how many rows? Default 10. Include user (name/email) and order status?

Once you confirm, I’ll implement:
- Route `routes/stats.js` with GET `/api/stats/dashboard?range=30d&limit=10`.
- Secure it (e.g., [protect](cci:1://file:///d:/nodeee/middleware/auth.js:3:0-46:2) + [authorize('admin','manager')](cci:1://file:///d:/nodeee/middleware/auth.js:48:0-57:2)).
- Use MongoDB aggregations on `Order` and `User` to compute:
  - revenue, sales (with chosen statuses, and date filter if provided),
  - subscriptions (per your definition),
  - activeNow (per your definition),
  - overview series (by day),
  - recentSales (latest N orders with user populated).
- Wire into [server.js](cci:7://file:///d:/nodeee/server.js:0:0-0:0) and document the returned JSON schema.

If you prefer, I can also expose a public variant for non-admin dashboards with restricted fields.

### User Input

Excellent ever created

*Updated todo list*

*Edited relevant file*

*Edited relevant file*

### Planner Response

Great! I also added a dashboard stats endpoint you can use right away.

What’s available now
- Endpoints:
  - GET `/api/stats/dashboard?range=30d&limit=10`
- Returned metrics:
  - Total Revenue: sum of orders with status in [paid, shipped, delivered] within range.
  - Subscriptions: count of active users (`User.isActive: true`).
  - Sales: number of orders with status in [paid, shipped, delivered] within range.
  - Active Now: users with `status: "active"` and `isActive: true`.
  - Overview: daily time series (revenue and orders) in range.
  - Recent Sales: latest N orders (default 10), with user info.

Security
- Protected: [protect](cci:1://file:///d:/nodeee/middleware/auth.js:3:0-46:2) + [authorize('admin','manager')](cci:1://file:///d:/nodeee/middleware/auth.js:48:0-57:2) in [routes/stats.js](cci:7://file:///d:/nodeee/routes/stats.js:0:0-0:0).

How to call
- Example:
  - GET `/api/stats/dashboard?range=30d&limit=10`
  - Headers: `Authorization: Bearer <admin_or_manager_token>`

Response shape
{
  "success": true,
  "range": { "start": "2025-08-21T...", "end": "2025-09-20T..." },
  "data": {
    "totalRevenue": 12345.67,
    "subscriptions": 1200,
    "sales": 89,
    "activeNow": 45,
    "overview": [
      { "date": "2025-09-01", "revenue": 500, "orders": 3 },
      ...
    ],
    "recentSales": [
      {
        "_id": "...",
        "totalAmount": 200,
        "currency": "USD",
        "status": "paid",
        "createdAt": "2025-09-19T...",
        "user": { "_id": "...", "name": "Jane", "email": "jane@example.com" }
      }
    ]
  }
}

Adjustments if you want
- Total Revenue/Sales statuses: change to include or exclude `pending` or `cancelled`.
- Subscriptions definition: count customers only (role `customer`), or new users in range.
- Active Now: track real-time activity (e.g., add a `lastActiveAt` field and update via middleware).
- Overview granularity: weekly/monthly buckets or multiple series (orders, revenue, users).

Say the word and I’ll tweak the calculations or add more KPIs (e.g., AOV, conversion rate, top products, top customers).

*Viewed [server.js](file:///d:/nodeee/server.js) *

### User Input

You did not complete the work I told you about, you did not even add the root to the server.js

### Planner Response

I'll open the full [server.js](cci:7://file:///d:/nodeee/server.js:0:0-0:0) to confirm the new routes are correctly registered and, if missing, add them.

*Viewed [server.js](file:///d:/nodeee/server.js) *

### Planner Response

I’ve completed the wiring and the root now lists the new endpoints.

What I added in server.js
- Route registrations:
  - `app.use("/api/requests", require("./routes/requests"));`
  - `app.use("/api/orders", require("./routes/orders"));`
  - `app.use("/api/cart", require("./routes/cart"));`
  - `app.use("/api/stats", require("./routes/stats"));`
- Root endpoint entries under `app.get("/", ...)`:
  - `requests: "/api/requests"`
  - `orders: "/api/orders"`
  - `cart: "/api/cart"`
  - `stats: "/api/stats"`

You can see them in:
- [server.js](cci:7://file:///d:/nodeee/server.js:0:0-0:0) lines around 65–69 (routes) and 95–99 (root endpoints list).

Quick test
- Start the server and open:
  - GET http://localhost:PORT/ → you’ll see the new `requests`, `orders`, `cart`, and `stats` entries.
  - GET http://localhost:PORT/api/health → should return “API is running”.

Do you want me to remove the earlier “requests” feature if you don’t need it anymore, or keep it?

*Viewed [orders.js](file:///d:/nodeee/routes/orders.js) *

### User Input

Wouldn't it be better, instead of sending a bady for the order, to check the card yourself, take the data on the card, and add it to the order?

*Edited relevant file*

### Planner Response

Yes—agreed. I’ve implemented that.

What changed
- In [routes/orders.js](cci:7://file:///d:/nodeee/routes/orders.js:0:0-0:0), the POST `/api/orders` endpoint now:
  - Accepts an optional `items` array.
  - If `items` is NOT provided, it will automatically read the current user’s cart ([models/Cart.js](cci:7://file:///d:/nodeee/models/Cart.js:0:0-0:0)), build the order from it using current product prices, and then clear the cart upon successful order creation.

Where
- File: [routes/orders.js](cci:7://file:///d:/nodeee/routes/orders.js:0:0-0:0)
  - Added `const Cart = require("../models/Cart");`
  - Enhanced the create route to fallback to the user’s cart when `req.body.items` is absent.

How to use
- From Cart (no body needed):
  - POST `/api/orders`
  - Headers: `Authorization: Bearer <token>`
  - Behavior: Uses the user’s cart; creates an order; clears the cart.
- Explicit payload (still supported):
  - POST `/api/orders`
  - Body:
    {
      "items": [
        { "productId": "<id1>", "quantity": 2 },
        { "productId": "<id2>", "quantity": 1 }
      ],
      "shippingAddress": { ... },
      "notes": "optional",
      "currency": "USD"
    }

Also available
- POST `/api/cart/checkout` already creates an order from the cart and clears it. Now you have both options:
  - Simple flow: POST `/api/orders` with no body.
  - Or explicit checkout endpoint: POST `/api/cart/checkout`.

Do you want me to:
- Deprecate and remove `/api/cart/checkout` to keep just one way?
- Or keep both for flexibility?

### User Input

I mean, isn't the user's cart? So when the cart calls the order's API, it takes all of its data that is in the cart and adds it or requests it in the order and deletes the cart.

*Edited relevant file*

### Planner Response

Thanks for clarifying — yes, I’ve implemented exactly that flow.

What happens now
- When you call POST `/api/orders` without an items body:
  - It automatically reads the authenticated user’s cart from [models/Cart.js](cci:7://file:///d:/nodeee/models/Cart.js:0:0-0:0).
  - Builds the order from the cart using current product prices.
  - Creates the order in [models/Order.js](cci:7://file:///d:/nodeee/models/Order.js:0:0-0:0).
  - Clears the user’s cart after successful creation.

Where it’s implemented
- [routes/orders.js](cci:7://file:///d:/nodeee/routes/orders.js:0:0-0:0)
  - Import added: `const Cart = require("../models/Cart");`
  - Create route logic updated to:
    - Use `req.body.items` if provided (still supported).
    - Otherwise fallback to the user’s cart.
    - After success, clear the cart.
  - Currency fallback: if you didn’t send a currency, it uses the cart’s currency or defaults to `"USD"`.

How to use
- From cart (recommended, no body):
  - POST `/api/orders`
  - Headers: `Authorization: Bearer <token>`
  - Result: Order created from cart, cart cleared.

- Still supported (explicit items):
  - POST `/api/orders`
  - Body:
    {
      "items": [{ "productId": "<id>", "quantity": 2 }],
      "shippingAddress": { ... },
      "notes": "optional",
      "currency": "USD"
    }

Optional clean-up
- If you want to enforce “cart-only” checkout, I can:
  - Remove items support from POST `/api/orders` and require empty body.
  - Remove `/api/cart/checkout` to keep a single canonical flow.
Just say the word and I’ll make that change.

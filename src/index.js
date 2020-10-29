require('dotenv').config()
const express = require('express')
const cors = require('cors')
require('./db/mongoose')
const userRouter = require('./routes/user')
const ordersRouter = require('./routes/orders')

const app = express()
const port = process.env.PORT

app.use(express.json())
app.use(cors())
app.use(userRouter)
app.use(ordersRouter)

app.listen(port, () => console.log('Connected on port', port))
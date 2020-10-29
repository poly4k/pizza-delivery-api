const mongoose = require('mongoose')
const validator = require('validator')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const querystring = require('querystring')
const MenuItem = require('./MenuItem')

const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        unique: true,
        required: true,
        trim: true,
        lowercase: true,
        validate(value) {
            if (!validator.isEmail(value)) {
                throw new Error('Email is invalid')
            }
        }
    },
    password: {
        type: String,
        required: true,
        trim: true,
        minlength: 6,
        validate(value) {
            if (value.toLowerCase().includes('password')) {
                throw new Error('Invalid password')
            }
        }
    },
    address: {
        type: String,
        required: true
    },
    tokens: [{
        token: {
            type: String,
            required: true
        }
    }],
    basket: [Number]
})

userSchema.methods.toJSON = function () {
    const user = this
    const userObject = user.toObject()

    delete userObject.password
    delete userObject.tokens

    return userObject
}

//generate auth token
userSchema.methods.generateAuthToken = async function () {
    let user = this

    //sign it with user ID
    const token = jwt.sign({ _id: user._id.toString() }, process.env.JSWT_SECRET_KEY)
    user.tokens = user.tokens.concat({ token })
    await user.save()

    return token
}

// add product to basket
userSchema.methods.updateBasket = async function (product_id) {
    let user = this

    if (product_id === undefined) {
        user.basket = []
    } else {
        user.basket = user.basket.concat(product_id)
    }

    await user.save()

    return user
}

//sum of items prices in basket
userSchema.methods.calculatePrice = async function () {
    let user = this
    let total = 0
    const menu = await MenuItem.find();

    user.basket.forEach(product_id => {
        for (let i of menu) {
            if (i.product_id === product_id) { total += i.price; break }
        }
    })

    return total
}

//create options and data object for a payment intent for total price of current basket
userSchema.methods.createPayment = async function () {
    const user = this

    //don't allow empty payments to be created
    if (!await user.calculatePrice()) throw new Error("Basket is empty")

    const data = querystring.stringify({
        amount: await user.calculatePrice() * 100,
        currency: 'ils',
        "payment_method_types[]": 'card',
        receipt_email: user.email
    })

    const options = {
        hostname: "api.stripe.com",
        path: '/v1/payment_intents',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': data.length,
            'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY
        }
    }

    return { data, options }
}


//create options and data objects for payment intent confirmation
userSchema.methods.confirmPayment = async function (id, card) {

    const data = querystring.stringify({
        payment_method: card
    })

    const options = {
        hostname: "api.stripe.com",
        path: '/v1/payment_intents/' + id + '/confirm',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY
        }
    }

    return { data, options }
}

//create options object for payment intent cancellation
userSchema.methods.cancelPayment = async function (id) {

    const options = {
        hostname: "api.stripe.com",
        path: '/v1/payment_intents/' + id + '/cancel',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY
        }
    }

    return options
}

//create options object for sending an email api request
userSchema.methods.sendEmail = async function () {

    const options = {
        host: "api.mailgun.net",
        path: "/v3/sandbox9df1d14d30084ba49596fea409e339d6.mailgun.org/messages",
        method: "POST",
        auth: 'api:' + process.env.MAILGUN_API_KEY
    }

    return options
}

//decrypt passwords and find existing matching accounts
userSchema.statics.findByCredentials = async (email, pass) => {
    const user = await User.findOne({ email })
    if (!user) throw new Error('Wrong email or password')

    const match = await bcrypt.compare(pass, user.password)
    if (!match) throw new Error('Wrong email or password')

    return user
}

//before we save any password we have to encrypt it
userSchema.pre('save', async function (next) {
    let user = this

    if (user.isModified('password')) {
        user.password = await bcrypt.hash(user.password, 8)
    }
    next()
})

const User = mongoose.model('User', userSchema)

module.exports = User
const mongoose = require('mongoose')

const menuItemSchema = mongoose.Schema({
    product_id: {
        type: Number,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    }
})

const MenuItem = mongoose.model('MenuItem', menuItemSchema)

module.exports = MenuItem
const express = require('express')
const router = new express.Router()
const https = require('https')
const FormData = require('form-data')
const MenuItem = require('../models/MenuItem')
const auth = require('../middleware/auth')

//get all menu items
router.get('/menu', auth, async (req, res) => {
    try {
        const menu = await MenuItem.find()

        res.status(200).send(menu)
    } catch (e) {
        res.status(500).send(e.message)
    }
})

//add product to basket by its ID
router.post('/addToBasket/:product_id', auth, async (req, res) => {
    try {
        const product_id = req.params.product_id

        await req.user.updateBasket(parseInt(product_id))

        res.status(200).send(req.user)
    } catch (e) {
        res.status(500).send(e.message)
    }
})

//register current basket overall price as payment intent
router.get('/placeOrder', auth, async (req, res) => {
    try {
        const { data, options } = await req.user.createPayment()

        //stripe intent api request
        const request = https.request(options, response => {
            response.on('data', d => {
                const intent = JSON.parse(d.toString())
                res.status(200).send({ id: intent.id, intent })
            })
        })

        request.on('error', error => {
            return error.message
        })

        request.write(data)
        request.end()
    } catch (e) {
        res.status(500).send(e.message)
    }
})

//confirm one of placed orders and send mails of confirmation
router.post('/confirmOrder/:id', auth, async (req, res) => {
    try {
        const { data, options } = await req.user.confirmPayment(req.params.id, req.body.card)

        //request for a payment confirmation stripe api
        const request = https.request(options, response => {

            //payment confirmation response
            response.on('data', async d => {
                const intent = JSON.parse(d.toString())

                //if succeeded send mail
                if (intent.status === 'succeeded') {
                    const receipt = intent.charges.data[0].receipt_url
                    const mopts = await req.user.sendEmail();
                    const form = new FormData()

                    req.user.basket = []
                    req.user.save()

                    form.append('subject', 'Invoice')
                    form.append(
                        'from', 
                        'Pizza Delivery <postmaster@sandbox9df1d14d30084ba49596fea409e339d6.mailgun.org>'
                    )
                    form.append(
                        'to', 
                        req.user.name + " <" + req.user.email + ">"
                    )
                    form.append(
                        'text', 
                        'Thank you for choosing us! Your order will be delivered soon!\n\n Here is link for your receipt: ' + receipt
                    )

                    //request for mailgun api
                    const mreq = https.request({ ...mopts, headers: form.getHeaders() }, mres => {
                        mres.on('data', md => console.log('md:', md.toString()))
                    })

                    form.pipe(mreq)

                    mreq.on('error', e => console.log('error mail:', e.message))
                    mreq.end()

                    res.status(200).send({ intent })
                } else {
                    res.status(400).send({ intent })
                }
            })
        })

        request.on('error', error => error.message)

        request.write(data)
        request.end()
    } catch (e) {
        res.status(500).send(e.message)
    }
})

//cancel any placed payment intent
router.post('/cancelPayment/:id', auth, async (req, res) => {
    try {
        const options = await req.user.cancelPayment(req.params.id)

        //stripe intent api request
        const request = https.request(options, response => {
            response.on('data', d => {
                const intent = JSON.parse(d.toString())
                res.status(200).send({ intent })
            })
        })

        request.on('error', error => {
            return error.message
        })

        request.end()
    } catch (e) {
        res.status(500).send(e.message)
    }
})

//clear basket
router.delete('/clearBasket', auth, async (req, res) => {
    try {
        await req.user.updateBasket()

        res.status(200).send(req.user)
    } catch (e) {
        res.status(500).send(e.message)
    }
})

module.exports = router
# Homework-Assignment-2
Building the API for a pizza-delivery company that uses mailgun and stripe API

When showing the menu, use the get method and type localhost:3000/orders

When ordering, you need to specify the token ID of the specified user in the headers. You can order as many pizzas as you want, just follow the syntax:
```
{
	"orders": {
		"order1" : {
			"id" : "P5",
			"quantity" : 5
		},
		"order2" : {
			"id" : "P3",
			"quantity" : 3
		}
	},
	"email" : "jaysonlee17@yahoo.com"
}
```

Since my account in mailgun is limited, I only have 2 verified email accounts that can receieve an email from mailgun. Other email accounts will not recieve the message :<<<

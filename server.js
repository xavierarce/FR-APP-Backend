import Express, { response }  from "express";
import bcrypt from "bcryptjs";
import cors from 'cors';
import knex from 'knex';
import axios from 'axios';  


const dbSQL = knex({
  client: 'pg',
  connection: {
    host : process.env.DATABASE_HOST,
    port : 5432,
    user : process.env.DATABASE_USER,
    password : process.env.DATABASE_PW,
    database : process.env.DATABASE_DB
  }
});



const app = Express();

app.use(Express.json());
app.use(cors());

app.get('/',(req,res)=>{
  {res.send('Its working')}
})

app.post('/signin',(req,res)=>{
  const {email, password} = req.body;
  if(!email || !password){
    return res.status(400).json('Incorrect form submission')
  }
  dbSQL.select('email','hash').from('login')
    .where('email','=', email)
    .then(data =>{
      const isValid = bcrypt.compareSync(password, data[0].hash); // true
      if(isValid){
        return dbSQL.select('*').from('users')
        .where('email','=', email)
        .then(user=>{
          res.json(user[0])
        })
        .catch(err => res.status(400).json('Unable to get user'))
      }
      res.status(404).json('wrong credentials')
    })
    .catch(err=> res.status(400).json('Wrong credentials'))
})

app.post('/register',(req,res)=>{
  const {email, name, password} = req.body;
  if(!email || !name || !password){
    return res.status(400).json('Incorrect form submission')
  }
  var salt = bcrypt.genSaltSync(10);
  var hash = bcrypt.hashSync(password, salt);
    dbSQL.transaction(trx=>{
      trx.insert({
        hash:hash,
        email:email
      })
      .into('login')
      .returning('email')
      .then(loginEmail=>{
        return trx('users')
        .returning('*')
        .insert({
          email: loginEmail[0].email,
          name : name,
          joined: new Date()
        }).then(user =>{
          res.json(user[0]);
        })  
      })
      .then(trx.commit)
      .catch(trx.rollback) 
    })
    
    .catch(err=>res.status(404).json('Unable to register'))
})

app.get('/profile/:id',(req,res)=>{
  const {id}=req.params;
  dbSQL('*').from('users').where({id})
    .then(user=>{
      if(user.length){
        res.json(user[0]);
      }else{
      res.status(404).json('Not Found');
      }
    }).catch(err=> res.status(404).json('Error getting user'))
  }
)

app.put('/image',(req,res)=>{
  const {id} =req.body;
  dbSQL('users').where('id', '=', id)
  .increment('entries', 1)
  .returning('entries')
  .then(entries => {
    res.json(entries[0].entries);
  })
  .catch(err=>res.status(400).json('Unable to get entries'))
})


const API_KEY = process.env.API_KEY; // Replace this with your actual API key

app.post('/detect-face', async (req, res) => {
  const { imageUrl } = req.body;

  // You can directly pass the imageUrl to the external API call
  const raw = JSON.stringify({
    "user_app_id": {
      "user_id": "clarifai",
      "app_id": "main"
    },
    "inputs": [
      {
        "data": {
          "image": {
            "url": imageUrl
          }
        }
      }
    ]
  });

  const requestOptions = {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Authorization': 'Key ' + API_KEY, // Pass the API key in the Authorization header
    },
    body: raw
  };

  // Now make the external API call
  try {
    const response = await axios.post(
      'https://api.clarifai.com/v2/models/face-detection/versions/6dc7e46bc9124c5c8824be4822abe105/outputs',
      raw, // Use raw here, not requestData
      requestOptions
    );

    res.json(response.data);
  } catch (error) {
    console.error('error', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.listen(3000,()=>{
    console.log('Running')
})


/* 
! --> res= this is working
! signin  --> POST = success/fail
! register --> POST =  user
! profile/:userId --> GET = user
! image --> PUT --> user (count)
*/ 

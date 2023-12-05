import express,{ Express } from 'express';
import './config/db'
import bodyParser from 'body-parser';
import path from 'path';
import { environmentConfig } from './config/environmentConfig';
import cors from 'cors'


const app:Express = express();
const port: number = environmentConfig.SERVER_PORT;

// importing routes
import authRoute from './routes/authRout';
import cronRoute from './routes/cronRoute';


// cors middleware 
app.use(cors({origin:'*', methods:'GET,POST,PUT,DELETE', credentials:true}));

// accept body middleware
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: false })); 
app.use(express.static(path.join(__dirname, 'views')));

// using middleware routes
app.use('/api/v1',authRoute)
app.use('/api/v1',cronRoute)


app.get('/', (req, res) => {
  res.status(200).send('Hello, There!');
});

// listening server
app.listen(port, () => {
  console.log(`Server is running on port ${port}...👍️`);

  // Simulating an error
  const error = false;
  if (error) {
    console.log(`Server could not start on port ${port}...😵`);
  }
});



export default app;

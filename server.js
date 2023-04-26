const express = require('express');
const mongoose = require('mongoose');
const shortid = require('shortid');
const crypto = require('crypto');

// define the user model
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  apiToken: { type: String, required: true, unique: true }
});

const User = mongoose.model('User', UserSchema);

// define the url model
const UrlSchema = new mongoose.Schema({
  originalUrl: { type: String, required: true },
  shortUrl: { type: String, required: true, unique: true, default: shortid.generate },
  clicks: { type: Number, default: 0 },
  clicksHistory: { type: [Date], default: [] },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const Url = mongoose.model('Url', UrlSchema);

// connect to the database
mongoose.connect('mongodb://localhost/url-shortener', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
  useFindAndModify: false
}).then(() => console.log('MongoDB connected'))
  .catch((err) => console.log(err));

const app = express();

app.use(express.json());

// middleware to check if the API token is valid
function getUserByApiToken(apiToken) {
  return User.findOne({ apiToken });
}

function requireApiToken(req, res, next) {
  const apiToken = req.headers['x-api-token'];
  if (!apiToken) {
    return res.status(401).json({ message: 'API token missing' });
  }

  // look up the user associated with the API token
  getUserByApiToken(apiToken)
    .then(user => {
      if (!user) {
        return res.status(401).json({ message: 'Invalid API token' });
      }

      // attach the user object to the request for later use
      req.user = user;
      next();
    })
    .catch(err => {
      console.log(err);
      return res.status(500).json({ message: 'Internal server error' });
    });
}

// creating a new user
app.post('/api/users', async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Missing name' });
  }

  try {
    const apiToken = shortid.generate();
    const user = new User({ name, apiToken });

    await user.save();

    return res.json({ apiToken });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});


// add a pre-save middleware to the UrlSchema
UrlSchema.pre('save', async function(next) {
  try {
    // get the user associated with the API token
    const user = await getUserByApiToken(this._userApiToken);
    if (!user) {
      // handle the case where the user is not found
      return next(new Error('User not found'));
    }

    // add the API request history to the user's clicksHistory array
    user.clicksHistory.push(new Date());
    await user.save();

    // set the user reference in the Url document
    this.user = user._id;
    next();
  } catch (err) {
    next(err);
  }
});

// update the /api/shorten route to set the _userApiToken property of the Url document
app.post('/api/shorten', requireApiToken, async (req, res) => {
  const { originalUrl } = req.body;

  if (!originalUrl) {
    return res.status(400).json({ message: 'Missing original URL' });
  }

  try {
    let apikey = req.headers['x-api-token'];
    const hash = crypto.createHash('sha256').update(originalUrl + apikey).digest('hex').substring(0, 8);
    let url = await Url.findOne({ shortUrl: hash });

    // check if URL already exists in db
    if (url) {
      return res.json({ shortUrl: url.shortUrl });
    }

    url = new Url({ originalUrl, shortUrl: hash, owner: req.user._id });
    url._userApiToken = apikey;
    await url.save();

    return res.json({ shortUrl: url.shortUrl });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// accessing a short URL
app.get('/:shortUrl', async (req, res) => {
  const { shortUrl } = req.params;

  try {
    const url = await Url.findOne({
      shortUrl
    });
    if (!url) {
      return res.status(404).json({ message: 'URL not found' });
    }

    url.clicks++;
    url.clicksHistory.push(new Date());
    await url.save();

    return res.redirect(url.originalUrl);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});


// get the top 10 most popular URLs
app.get('/api/popular', async (req, res) => {
  try {
    const urls = await Url.find().sort({ clicks: -1 }).limit(10);
    return res.json(urls);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

//get the owner of a short URL
app.get('/api/owner/:shortUrl', async (req, res) => {
  const { shortUrl } = req.params;

  
});



const port = process.env.PORT || 3000;

app.listen(1000, () => console.log("Server listening on port 1000"));    
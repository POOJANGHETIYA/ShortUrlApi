const mongoose = require('mongoose');
const shortid = require('shortid');

mongoose.connect('mongodb://localhost/url-shortener', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
  useFindAndModify: false
}).then(() => console.log('MongoDB connected'))
  .catch((err) => console.log(err));

const urlSchema = new mongoose.Schema({
  originalUrl: {
    type: String,
    required: true
  },
  shortUrl: {
    type: String,
    required: true,
    default: shortid.generate
  },
  clicks: {
    type: Number,
    required: true,
    default: 0
  },
  dateOfCreation: {
    type: Date,
    required: true,
    default: Date.now
  },
  clicksHistory: {
    type: Array,
    required: true,
    default: []
  }
});

const Url = mongoose.model('Url', urlSchema);

module.exports = Url;

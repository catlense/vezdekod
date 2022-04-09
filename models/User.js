import mongoose from "mongoose";

const schema = mongoose.Schema({
  id: String,
  name: String,
  surname: String,
  likes: Number,
  dislikes: Number,
  watched: [String],
  memes: [Object]
})

export default mongoose.model('User', schema)
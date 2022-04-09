import mongoose from "mongoose";

const schema = mongoose.Schema({
  id: String,
  file: String,
  likes: Number,
  dislikes: Number
})

export default mongoose.model('Meme', schema)
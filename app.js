const express = require('express');
const expressListEndpoints = require('express-list-endpoints');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 3000;
const cors = require('cors');
const bodyParser = require("body-parser");
const path = require('path');
app.use(cors());
app.use(express.json());
require('dotenv').config();



// const mongoURI =
//     'mongodb+srv://katuokleee:pamirsiu@cluster0.rh6yf6q.mongodb.net/?retryWrites=true&w=majority';


mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});


const db = mongoose.connection;



db.on('error', (error) => {
    console.error('MongoDB Connection Error:', error);
});

db.once('open', () => {
    console.log('Connected to MongoDB');
});


const postSchema = new mongoose.Schema({
    title: String,
    image: String,
    username: String,
    likes: Number,
    comments: [
        {
            username: String,
            text: String,
        },
    ],
    createdAt: Date,
});

const Post = mongoose.model('Post', postSchema);
const messageSchema = new mongoose.Schema({
    sender: String,
    recipient: String,
    text: String,
    timestamp: Date,
});

const Message = mongoose.model('Message', messageSchema);

const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    image: {
        type: String,
        default: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'
    },
    messages: [
        {
            sender: String,
            recipient: String,
            text: String,
            timestamp: Date,
        },
    ],
});
const User = mongoose.model('Users', userSchema);

app.post('/register', async (req, res) => {
    try {
        const { username, password1 } = req.body;
        console.log('Received registration request:', req.body);


        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists.' });
        }


        if (password1.length < 4 ||password1.length >20|| !/\d/||!/[A-Z]/.test(password1)) {
            return res.status(400).json({
                error:
                    'Invalid password. Use one uppercase letter, and the length must be more than 4, add one number.',
            });
        }
        if (username.length < 4 || username.length > 20) {
            return res.status(400).json({
                error: 'Invalid username. The username length must be between 4 and 20 characters.',
            });
        }
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password1, saltRounds);



        const newUser = new User({
            username,
            password: hashedPassword,
        });

        console.log('New User:', newUser);

        await newUser.save();
        console.log('User saved successfully');
        res.status(200).json({ message: 'Registration successful' });
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ error: 'Registration failed', message: error.message });
    }
});
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;


        const user = await User.findOne({ username });


        if (password.length < 4 ||password.length >20|| !/\d/||!/[A-Z]/.test(password)) {
            return res.status(400).json({
                error:
                    'Invalid password. Use one uppercase letter, and the length must be more than 4, add one number.',
            });
        }
        if (username.length < 4 || username.length > 20) {
            return res.status(400).json({
                error: 'Invalid username. The username length must be between 4 and 20 characters.',
            });
        }


        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }


        const token = jwt.sign({ username: user.username }, 'your-secret-key');

        res.status(200).json({ token, username: user.username });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Login failed', message: error.message });
    }
});
app.post('/change-password', async (req, res) => {
    console.log('Request Body:', req.body);

    const { username, oldPassword, newPassword } = req.body;
    console.log('Received change password request:');
    console.log('Username:', username);
    console.log('Old Password:', oldPassword);
    console.log('New Password:', newPassword);
    try {
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        const passwordMatch = await bcrypt.compare(oldPassword, user.password);

        if (!passwordMatch) {
            return res.status(401).json({ message: 'Authentication failed' });
        }

        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        await User.updateOne({ username }, { password: newPasswordHash });

        res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ error: 'Password change failed', message: error.message });
    }
});
app.get('/user', async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1]; // Get the token from the header
        const decoded = jwt.verify(token, 'your-secret-key');

        const username = decoded.username;

        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({ username: user.username, image: user.image });
    } catch (error) {
        console.error('User data retrieval error:', error);
        res.status(500).json({ error: 'User data retrieval failed', message: error.message });
    }
});
app.get('/get-users', async (req, res) => {
    try {
        const users = await User.find({}, { _id: 0, password: 0 }); // Exclude _id and password fields
        res.status(200).json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Error fetching users', message: error.message });
    }
});
app.post('/change-image', async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, 'your-secret-key');
        const username = decoded.username;
        const newImage = req.body.image;

        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }


        user.image = newImage;
        await user.save();

        res.status(200).json({ message: 'Image changed successfully' });
    } catch (error) {
        console.error('Image change error:', error);
        res.status(500).json({ error: 'Image change failed', message: error.message });
    }
});

app.post('/create-post', async (req, res) => {
    const { title, image } = req.body;


    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, 'your-secret-key');
    const username = decoded.username;

    const newPost = new Post({
        title,
        image,
        username,
        likes: 0,
        comments: [],
        createdAt: new Date(),
    });

    try {
        const savedPost = await newPost.save();
        res.status(200).json(savedPost);
    } catch (error) {
        res.status(500).json({ error: 'Post creation failed', message: error.message });
    }
});

app.get('/get-posts', async (req, res) => {
    try {
        const posts = await Post.find({});
        res.status(200).json(posts);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching posts', message: error.message });
    }
});
app.post('/like-post', async (req, res) => {
    try {


        const { postId } = req.body;


        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }


        post.likes += 1;


        await post.save();

        res.status(200).json(post);
    } catch (error) {
        console.error('Error while liking a post:', error);
        res.status(500).json({ error: 'Liking a post failed', message: error.message });
    }
});
app.post('/unlike-post', async (req, res) => {
    try {
        const { postId } = req.body;
        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        post.likes -= 1;

        await post.save();

        res.status(200).json(post);
    } catch (error) {
        console.error('Error while unliking a post:', error);
        res.status(500).json({ error: 'Unliking a post failed', message: error.message });
    }
});

app.post('/add-comment', async (req, res) => {
    try {

        const { postId, text } = req.body;


        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }


        const token = req.headers.authorization.split(' ')[1];// Extract the user's username from the token
        const decoded = jwt.verify(token, 'your-secret-key');
        const username = decoded.username;


        const newComment = {
            username,
            text,
        };


        post.comments.push(newComment);


        await post.save();

        res.status(200).json(post);
    } catch (error) {
        console.error('Error while adding a comment:', error);
        res.status(500).json({ error: 'Adding a comment failed', message: error.message });
    }
});
app.get('/get-post/:postId', async (req, res) => {
    const { postId } = req.params;
    try {
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        res.status(200).json(post);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching post by ID', message: error.message });
    }
});
app.get('/user-image/:username', async (req, res) => {
    try {
        const username = req.params.username;
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userImage = user.image;
        res.status(200).json({ image: userImage });
    } catch (error) {
        console.error('User image retrieval error:', error);
        res.status(500).json({ error: 'User image retrieval failed', message: error.message });
    }
});
app.post('/send-message', async (req, res) => {
    try {
        const { recipient, message } = req.body;


        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, 'your-secret-key');
        const senderUsername = decoded.username;


        const sender = await User.findOne({ username: senderUsername });
        const recipientUser = await User.findOne({ username: recipient });

        if (!sender || !recipientUser) {
            return res.status(404).json({ error: 'User not found' });
        }


        const newMessage = {
            sender: senderUsername,
            recipient: recipient,
            text: message,
            timestamp: new Date(),
        };


        sender.messages.push(newMessage);
        recipientUser.messages.push(newMessage);


        await sender.save();
        await recipientUser.save();

        res.status(200).json({ message: 'Message sent successfully' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Message sending failed', message: error.message });
    }
});
app.get('/get-messages', async (req, res) => {
    try {

        const token = req.headers.authorization.split(' ')[1];// Fetch messages for the authenticated user
        const decoded = jwt.verify(token, 'your-secret-key');
        const username = decoded.username;

        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }


        const messages = user.messages;

        res.status(200).json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Error fetching messages', message: error.message });
    }
});

app.get('/get-user-profile-photos', async (req, res) => {
    try {
        const users = await User.find({}, { _id: 0, username: 1, image: 1 }); // Fetch usernames and profile photos

        const profilePhotos = {};
        users.forEach((user) => {
            profilePhotos[user.username] = user.image;
        });

        res.status(200).json(profilePhotos);
    } catch (error) {
        console.error('Error fetching user profile photos:', error);
        res.status(500).json({ error: 'Error fetching user profile photos', message: error.message });
    }
});
app.post('/get-messages-between-users', async (req, res) => {
    try {

        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, 'your-secret-key');
        const senderUsername = decoded.username;

        const { recipient } = req.body;


        const sender = await User.findOne({ username: senderUsername });

        if (!sender) {
            return res.status(404).json({ error: 'User not found' });
        }


        const recipientUser = await User.findOne({ username: recipient });

        if (!recipientUser) {
            return res.status(404).json({ error: 'Recipient not found' });
        }


        const messages = sender.messages.filter(
            (message) => (message.sender === recipient && message.recipient === senderUsername) || (message.sender === senderUsername && message.recipient === recipient)
        );

        res.status(200).json(messages);
    } catch (error) {
        console.error('Error fetching messages between users:', error);
        res.status(500).json({ error: 'Error fetching messages between users', message: error.message });
    }
});


app.use(express.static(path.join(__dirname, 'build')));


app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});


app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

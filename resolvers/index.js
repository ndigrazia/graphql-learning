const { GraphQLScalarType } = require('graphql')
const fetch = require('node-fetch')

const requestGithubToken = credentials => 
    fetch(
        'https://github.com/login/oauth/access_token',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify(credentials)
        }
    ).then(res => res.json())

const requestGithubUserAccount = token => 
    fetch(`https://api.github.com/user?access_token=${token}`)
        .then(res => res.json())
        
const authorizeWithGithub = async credentials => {
    const { access_token } = await requestGithubToken(credentials)
    const githubUser = await requestGithubUserAccount(access_token)
    return { ...githubUser, access_token }
}

var _id = 4

var tags = [
  { 'photoID': '1', 'userID': 'gPlake' },
  { 'photoID': '2', 'userID': 'sSchmidt' },
  { 'photoID': '2', 'userID': 'mHattrup' },
  { 'photoID': '2', 'userID': 'gPlake' }
]

var users = [
  { 'githubLogin': 'mHattrup', 'name': 'Mike Hattrup' },
  { 'githubLogin': 'gPlake', 'name': 'Glen Plake' },
  { 'githubLogin': 'sSchmidt', 'name': 'Scot Schmidt' }
]

var photos = [
  {
    'id': '1',
    'name': 'Dropping the Heart Chute',
    'description': 'The heart chute is one of my favorite chutes',
    'category': 'ACTION',
    'githubUser': 'gPlake',
    'created': '3-28-1977'
  },
  {
    'id': '2',
    'name': 'Enjoying the sunshine',
    'category': 'SELFIE',
    'githubUser': 'sSchmidt',
    'created': '3-28-1977'
  },
  {
    id: '3',
    'name': 'Gunbarrel 25',
    'description': '25 laps on gunbarrel today',
    'category': 'LANDSCAPE',
    'githubUser': 'sSchmidt',
    'created': '3-28-1977'
  }
]

const resolvers = {
    Query: {
      me: (parent, args, { currentUser }) => currentUser,
      totalPhotos: () => photos.length,
      allPhotos: () => photos,
      allUsers: () => users,
      allPhotosMongo: (parent, args, { db }) =>
        db.collection('photos').find().toArray()
    },
    Mutation: {
      async postPhoto(parent, args, { db, currentUser }) {
        if (!currentUser) {
          throw new Error('only an authorized user can post a photo')
        }

        const newPhoto = {
          ...args.input,
          userID: currentUser.githubLogin,
          created: new Date()
        }

        const { insertedIds } = await db.collection('photos').insert(newPhoto)
        newPhoto.id = insertedIds[0]
        
        return newPhoto

      },

      /*postPhoto(parent, args) {
  
        // 2. Create a new photo, and generate an id
          var newPhoto = {
            id: _id++,
            ...args.input,
            created: new Date()
        }
  
        photos.push(newPhoto)
  
        // 3. Return the new photo
        return newPhoto
  
      },*/

      async githubAuth(parent, { code }, { db }) {
        // 1. Obtain data from GitHub
          let {
            message,
            access_token,
            avatar_url,
            login,
            name
          } = await authorizeWithGithub({
            client_id: "90727a123b1ab05d4081",
            client_secret: "08d19cc569460350e5fc2ee5350bef54eafec0ca",
            code
          })
        // 2. If there is a message, something went wrong
          if (message) {
            throw new Error(message)
          }
        // 3. Package the results into a single object
          let latestUserInfo = {
            name,
            githubLogin: login,
            githubToken: access_token,
            avatar: avatar_url
          }
        // 4. Add or update the record with the new information
          const { ops:[user] } = await db
            .collection('users')
            .replaceOne({ githubLogin: login }, latestUserInfo, { upsert: true })
        // 5. Return user data and their token
          return { user, token: access_token }
      
        }
    
   },
   /*Photo: {
      url: current => `http://yoursite.com/img/${current.id}.jpg`,
      postedBy: current => {
        return users.find(u => u.githubLogin === current.githubUser)
      },
      taggedUsers: current => tags.filter(tag => tag.photoID === current.id).map(tag => tag.userID)
        .map(userID => users.find(u => u.githubLogin === userID))
    },*/
    Photo: {
      id: current => current.id || current._id,
      url: current => `/img/photos/${current._id}.jpg`,
      postedBy: (current, args, { db }) => 
        db.collection('users').findOne({ githubLogin: current.userID })
    },    
    User: {
      postedPhotos: current => {
        return photos.filter(p => p.githubUser === current.githubLogin)
      },
      inPhotos: current => tags.filter(tag => tag.userID === current.id).map(tag => tag.photoID)
        .map(photoID => photos.find(p => p.id === photoID))
    },
    DateTime: new GraphQLScalarType({
      name: 'DateTime',
      description: 'A valid date time value.',
      parseValue: value => new Date(value),
      serialize: value => new Date(value).toISOString(),
      parseLiteral: ast => ast.value
    })
  
  }
  
  module.exports = resolvers
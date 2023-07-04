import Conf from 'conf';


const schema = {
  isPublishing: {
    type: 'boolean',
    default: false
  },
  hasSeenPrepublishWarning: {
    type: 'boolean',
    default: false
  }
};


const config = new Conf({
  projectName: '@darkobits/re-pack',
  schema
});


export default config;

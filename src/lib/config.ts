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


// @ts-expect-error - Typings are wonky for this package at the moment.
const config = new Conf({ schema });


export default config;

import RTokenUtils, { getClient } from '../../src';

export const getRutils = () => {
  const uri = 'http://localhost:8000/subgraphs/name/rtoken-test';
  // TODO: set uri based on process.env for local/production testing

  const apolloInstance = getClient({
    uri,
    debug: false,
  });
  const options = { debug: true };
  return new RTokenUtils(apolloInstance, options);
};

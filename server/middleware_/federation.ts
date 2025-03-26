import { integrateFederation } from '@fedify/h3';
import federation from '../utils_/federation';

export default integrateFederation(federation, (event, request) => undefined);
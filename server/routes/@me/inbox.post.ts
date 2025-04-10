import { acceptFollowRequest } from "~/server/utils/federation";

// routes/@[username]/inbox.post.ts
export default defineEventHandler(async (event) => {
  let activity: Activity;
  try {
    // h3's readBody automatically parses JSON based on Content-Type
    activity = await readBody(event);
    console.log('Activity:', activity);
    if (!activity || typeof activity !== 'object') {
      return sendError(event, createError({ statusCode: 400, statusMessage: `Invalid request body.` }));
    }
  } catch (e) {
    return sendError(event, createError({ statusCode: 400, statusMessage: `Failed to parse request body` }));
  }
  console.log(JSON.stringify(activity, null, 2));

  // TODO: Process the activity (store, handle Follow, Create, etc.)
  switch (activity.type) {
    case 'Follow':
      console.log('Follow', activity);
      return await acceptFollowRequest(event, activity as FollowActivity);
    default:
      setResponseStatus(event, 400); // 400 Bad Request
      send(event, `Unsupported activity type: ${activity.type}`);
      return;
  }
});
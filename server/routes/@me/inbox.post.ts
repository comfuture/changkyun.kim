// routes/users/[username]/inbox.post.ts
export default defineEventHandler(async (event) => {
  // --- VERY IMPORTANT: Authentication/Authorization Missing ---
  // In a real server, verify HTTP Signatures here before processing.
  // This minimal example SKIPS verification for simplicity.
  let activity;
  try {
    // h3's readBody automatically parses JSON based on Content-Type
    activity = await readBody(event);
    if (!activity || typeof activity !== 'object') {
      return sendError(event, createError({ statusCode: 400, statusMessage: `Invalid request body.` }));
    }
  } catch (e: any) {
    console.error("Error reading/parsing inbox body:", e);
    return sendError(event, createError({ statusCode: 400, statusMessage: `Failed to parse request body: ${e.message}` }));
  }
  console.log(JSON.stringify(activity, null, 2));

  // TODO: Process the activity (store, handle Follow, Create, etc.)

  setResponseStatus(event, 202); // 202 Accepted
  return send(event, 'Accepted'); // Send simple confirmation
});
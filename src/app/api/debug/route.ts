export async function GET() {
  return new Response('Debug response - plain text', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}

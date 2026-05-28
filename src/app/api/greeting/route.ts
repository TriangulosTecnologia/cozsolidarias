import { gateway } from '../../../gateway';

export const GET = async () => {
  const greeting = await gateway.getGreeting();
  return Response.json(greeting);
};

import { gateway } from '../gateway';

export default async function Page() {
  const greeting = await gateway.getGreeting();

  return (
    <main>
      <h1>{greeting.text}</h1>
    </main>
  );
}

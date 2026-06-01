export type RedisResponseType = RedisResponseItem[];

type RedisResponseItem = {
  name: string;
  messages: RedisMessage[];
};

type RedisMessage = {
  id: string;
  message: Record<string, string>;
};

import { error } from "@sveltejs/kit";

type OwnedResourceDelegate = {
  findFirst(args: {
    where: { id: string; userId: string };
    select: { id: true };
  }): Promise<{ id: string } | null>;
};

export async function requireOwnedResource(
  delegate: OwnedResourceDelegate,
  userId: string,
  id: string,
  message: string,
) {
  const resource = await delegate.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!resource) {
    error(404, message);
  }

  return resource;
}

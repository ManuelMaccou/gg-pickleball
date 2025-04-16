import User from "@/app/models/User"
import connectToDatabase from "../mongodb"
import { SessionData } from "@auth0/nextjs-auth0/types";

export async function getOrCreateUserByAuth0Id(auth0Id: string, session: SessionData | null) {
  await connectToDatabase();

  let user = await User.findOne({ auth0Id })

  if (!user){
    user = await User.create({ 
      auth0Id,
      name: session?.user.name,
      email: session?.user.email,
    })
  }
  return user
}

export async function getOrCreateGuestUser(name: string) {
  await connectToDatabase();
  
  let user = await User.findOne({
    name: new RegExp(`^${name}$`, 'i'),
    auth0Id: { $exists: false },
  })
  if (!user) {
    user = await User.create({ name })
  }
  return user
}

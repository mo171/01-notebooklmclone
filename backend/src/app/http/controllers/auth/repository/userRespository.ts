import { User } from "@/app/bootstrap/models/userSchema";
import { generateTokens } from "@/app/helpers/jwt";
import { GoogleUserType } from "@/types/user-types";

export class UserRepository {
  private static instance: UserRepository;

  public static getInstance(): UserRepository {
    if (!UserRepository.instance) {
      UserRepository.instance = new UserRepository();
    }
    return UserRepository.instance;
  }

  async createOrUpdateUser(
    userProps: GoogleUserType,
    googleOAuth: { accessToken: string; refreshToken?: string },
  ) {
    const { sub: googleId, name, picture, email } = userProps._json;

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        image: picture,
        googleAccessToken: googleOAuth.accessToken,
        googleRefreshToken: googleOAuth.refreshToken,
        googleId,
      });
    } else {
      user.name = name ?? user.name;
      user.image = picture ?? user.image;
      user.googleId = googleId;
      user.googleAccessToken = googleOAuth.accessToken;
      if (googleOAuth.refreshToken) {
        user.googleRefreshToken = googleOAuth.refreshToken;
      }
      await user.save();
    }

    const token = await generateTokens(user._id);

    return {
      authData: {
        ...user.toObject(),
        token,
      },
    };
  }
}

import config from "../config";
import { redisClient } from "./redis";

export const bkashIdToken = async () => {
    try {
        const IdTokenKey = "bkash:idToken";
        const RefreshTokenKey = "bkash:refreshToken";

        let bkashIdToken = await redisClient.get(IdTokenKey);
        let bkashRefreshToken = await redisClient.get(RefreshTokenKey);

        const bkashIdTokenTTl = await redisClient.ttl(IdTokenKey);

        // Generate new id_token from refresh_token
        if (bkashIdTokenTTl <= 600 && bkashRefreshToken) {
            const refreshTokenResponse = await fetch(
                `${config.bkash_base_url}/tokenized/checkout/token/refresh`,
                {
                    method: "POST",
                    headers: {
                        "content-type": "application/json",
                        Accept: "application/json",
                        username: config.bkash_username,
                        password: config.bkash_password,
                    },
                    body: JSON.stringify({
                        app_key: config.bkash_app_key,
                        app_secret: config.bkash_app_secret,
                        refresh_token: bkashRefreshToken,
                    }),
                },
            );

            const bkashRefreshTokenResult = await refreshTokenResponse.json();

            bkashIdToken = bkashRefreshTokenResult.id_token;

            await redisClient.set(IdTokenKey, bkashIdToken as string, {
                expiration: {
                    type: "EX",
                    value: 60 * 60,
                },
            });
            return bkashIdToken;
        }

        if (bkashIdToken) {
            // Check if id_token is present in redis

            return bkashIdToken;
        }

        // Generation of id_token and refresh_token from bkash
        const response = await fetch(
            `${config.bkash_base_url}/tokenized/checkout/token/grant`,
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    Accept: "application/json",
                    username: config.bkash_username,
                    password: config.bkash_password,
                },
                body: JSON.stringify({
                    app_key: config.bkash_app_key,
                    app_secret: config.bkash_app_secret,
                }),
            },
        );

        if (!response.ok) {
            throw new Error("Bkash Access Token Grant Failed!");
        }

        const result = await response.json();

        console.log("result 22: ", result);

        // Store generated token in redis
        await redisClient.set(IdTokenKey, result.id_token, {
            expiration: {
                type: "EX",
                value: 60 * 60,
            },
        });

        // Store generated Refresh Token in Redis
        await redisClient.set(RefreshTokenKey, result.refresh_token, {
            expiration: {
                type: "EX",
                value: 60 * 60 * 24 * 28,
            },
        });

        bkashIdToken = result.id_token;

        return bkashIdToken;
    } catch (error: any) {
        throw new Error(error.message);
    }
};

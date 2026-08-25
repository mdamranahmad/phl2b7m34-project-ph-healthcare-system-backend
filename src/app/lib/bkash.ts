import config from "../config";
import { AppError } from "../utils/AppError";
import httpStatus from "http-status";
import { redisClient } from "./redis";

export const getBkashIdToken = async () => {
	try {
		const IdTokenKey = "bkash:idToken";
		const RefreshTokenKey = "bkash:refreshToken";

		let bkashIdToken = await redisClient.get(IdTokenKey);
		const bkashRefreshToken = await redisClient.get(RefreshTokenKey);

		const bkashIdTokenTTL = await redisClient.ttl(IdTokenKey);
		const bkashRefreshTokenTTL = await redisClient.ttl(RefreshTokenKey);

		// console.log({
		//     bkashIdToken,
		//     bkashRefreshToken,
		//     bkashIdTokenTTL,
		//     bkashRefreshTokenTTL,
		// });

		// Generate new id_token from refresh_token
		if (
			(bkashIdTokenTTL <= 600 || !bkashIdToken) &&
			bkashRefreshToken &&
			bkashRefreshTokenTTL > 600
		) {
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

			if (!refreshTokenResponse.ok) {
				throw new AppError(httpStatus.BAD_GATEWAY, "Bkash Access Token Grant Failed!");
			}

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

		if (bkashIdTokenTTL > 600) {
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
			throw new AppError(httpStatus.BAD_GATEWAY, "Bkash Access Token Grant Failed!");
		}

		const result = await response.json();

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
		throw new AppError(httpStatus.BAD_GATEWAY, error.message);
	}
};

import mongoose, { Schema, Document, Model } from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto-js'
import jwt from 'jsonwebtoken'

// Base interface for User document
interface IUser extends Document {
    email: string;
    username: string;
    salt: string;
    hash: string;
    resetToken?: string;
    resetTokenExpiration?: Date;
    password?: string;
    setPassword(password: string): void;
    validPassword(password: string): boolean;
    generateJwt(): string;
}

// Schema interface
interface IUserSchema extends mongoose.Schema<IUser> {
    methods: {
        setPassword(password: string): void;
        validPassword(password: string): boolean;
        generateJwt(): string;
    }
}

export class UserModel {
    static model: Model<IUser>;
    
    public static init() {
        const userSchema = new mongoose.Schema({
            email: {
                type: String,
                unique: true,
                required: true
            },
            username: {
                type: String,
                unique: true,
                required: true
            },
            hash: String,
            salt: String,
            resetToken: String,
            resetTokenExpiration: Date
        }) as IUserSchema;

        userSchema.methods.setPassword = function(this: IUser, password: string): void {
            this.salt = crypto.lib.WordArray.random(16).toString();
            this.hash = crypto.PBKDF2(password, this.salt, { keySize: 512 / 32 }).toString(crypto.enc.Hex);
        };

        userSchema.methods.validPassword = function(this: IUser, password: string): boolean {
            const hash = crypto.PBKDF2(password, this.salt, { keySize: 512 / 32 }).toString(crypto.enc.Hex);
            return this.hash === hash;
        };

        userSchema.methods.generateJwt = function(this: IUser): string {
            const expiry = new Date();
            expiry.setDate(expiry.getDate() + 7);

            const userJwt: UserJwt = {
                _id: this._id,
                email: this.email,
                username: this.username,
                exp: expiry.getTime() / 1000
            };
            return jwt.sign(userJwt, process.env.JWT_SECRET as string);
        };

        UserModel.model = mongoose.model<IUser>('User', userSchema);
    }

    public static isUser(obj: any): obj is IUser {
        return obj && obj.username && typeof obj.username === 'string';
    }
}

export type User = IUser;

export interface UserJwt {
  _id: string;
  email: string;
  username: string;
  exp: number;
}
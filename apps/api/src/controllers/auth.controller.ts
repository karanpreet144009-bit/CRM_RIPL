import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as auth from '../services/auth.service.js';
import { env } from '../config/env.js';
const loginSchema=z.object({email:z.string().trim().email().max(254).transform(x=>x.toLowerCase()),password:z.string().min(1).max(128)});
const cookieOptions={httpOnly:true,secure:env.COOKIE_SECURE,sameSite:'strict' as const,path:'/api/v1/auth',maxAge:env.REFRESH_TOKEN_DAYS*86400_000};
function publicUser(user: Awaited<ReturnType<typeof auth.login>>['user']) { return {id:user.id,email:user.email,forcePasswordChange:user.forcePasswordChange,employee:user.employee && {id:user.employee.id,fullName:user.employee.fullName},roles:user.userRoles.map(x=>x.role.code)}; }
export async function login(req:Request,res:Response,next:NextFunction){try{const input=loginSchema.parse(req.body);const result=await auth.login(input.email,input.password,req.ip);res.cookie('rrpl_refresh',result.refreshToken,cookieOptions).status(200).json({success:true,data:{accessToken:result.accessToken,user:publicUser(result.user)}})}catch(e){next(e)}}
export async function refresh(req:Request,res:Response,next:NextFunction){try{const result=await auth.rotate(req.cookies.rrpl_refresh);res.cookie('rrpl_refresh',result.refreshToken,cookieOptions).json({success:true,data:{accessToken:result.accessToken,user:publicUser(result.user)}})}catch(e){next(e)}}
export async function logout(req:Request,res:Response,next:NextFunction){try{await auth.logout(req.cookies.rrpl_refresh);res.clearCookie('rrpl_refresh',{...cookieOptions,maxAge:undefined});res.status(204).send()}catch(e){next(e)}}

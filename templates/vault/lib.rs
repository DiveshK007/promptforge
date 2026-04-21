use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("{{PROGRAM_ID}}");

#[program]
pub mod {{program_name}} {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        let state = &mut ctx.accounts.vault_state;
        state.owner = ctx.accounts.owner.key();
        state.mint = ctx.accounts.mint.key();
        state.token_bump = ctx.bumps.vault_token;
        msg!("Vault initialized for owner {}", ctx.accounts.owner.key());
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::ZeroAmount);

        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.vault_token.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(),
        };
        token::transfer(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            amount,
        )?;

        msg!("Deposited {} tokens into vault", amount);
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::ZeroAmount);
        require!(ctx.accounts.vault_token.amount >= amount, VaultError::InsufficientFunds);

        let owner_key = ctx.accounts.vault_state.owner;
        let mint_key = ctx.accounts.vault_state.mint;
        let token_bump = ctx.accounts.vault_state.token_bump;

        let seeds = &[b"vault".as_ref(), owner_key.as_ref(), mint_key.as_ref(), &[token_bump]];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_token.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.vault_token.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi_accounts, signer),
            amount,
        )?;

        msg!("Withdrew {} tokens from vault", amount);
        Ok(())
    }
}

#[account]
pub struct VaultState {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub token_bump: u8,
}

impl VaultState {
    pub const LEN: usize = 8 + 32 + 32 + 1;
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(init, payer = owner, space = VaultState::LEN)]
    pub vault_state: Account<'info, VaultState>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub mint: Account<'info, anchor_spl::token::Mint>,
    #[account(
        init,
        payer = owner,
        seeds = [b"vault", owner.key().as_ref(), mint.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = vault_token,
    )]
    pub vault_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(has_one = owner, has_one = mint)]
    pub vault_state: Account<'info, VaultState>,
    pub owner: Signer<'info>,
    pub mint: Account<'info, anchor_spl::token::Mint>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref(), mint.key().as_ref()],
        bump = vault_state.token_bump,
    )]
    pub vault_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(has_one = owner, has_one = mint)]
    pub vault_state: Account<'info, VaultState>,
    pub owner: Signer<'info>,
    pub mint: Account<'info, anchor_spl::token::Mint>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref(), mint.key().as_ref()],
        bump = vault_state.token_bump,
    )]
    pub vault_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum VaultError {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Insufficient vault balance")]
    InsufficientFunds,
}

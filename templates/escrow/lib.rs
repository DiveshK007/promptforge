use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("{{PROGRAM_ID}}");

#[program]
pub mod {{program_name}} {
    use super::*;

    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
        amount: u64,
        unlock_time: i64,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        escrow.depositor = ctx.accounts.depositor.key();
        escrow.recipient = ctx.accounts.recipient.key();
        escrow.amount = amount;
        escrow.unlock_time = unlock_time;
        escrow.is_released = false;

        // Transfer tokens to escrow vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.depositor_token_account.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.depositor.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer(CpiContext::new(cpi_program, cpi_accounts), amount)?;

        msg!("Escrow initialized: {} tokens, unlocks at {}", amount, unlock_time);
        Ok(())
    }

    pub fn release_escrow(ctx: Context<ReleaseEscrow>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        let clock = Clock::get()?;

        require!(!escrow.is_released, EscrowError::AlreadyReleased);
        require!(clock.unix_timestamp >= escrow.unlock_time, EscrowError::NotYetUnlocked);

        escrow.is_released = true;

        // Transfer from vault to recipient
        let seeds = &[b"vault", escrow.depositor.as_ref(), &[ctx.bumps.vault]];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.recipient_token_account.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer(CpiContext::new_with_signer(cpi_program, cpi_accounts, signer), escrow.amount)?;

        msg!("Escrow released: {} tokens to recipient", escrow.amount);
        Ok(())
    }
}

#[account]
pub struct Escrow {
    pub depositor: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub unlock_time: i64,
    pub is_released: bool,
}

#[derive(Accounts)]
pub struct InitializeEscrow<'info> {
    #[account(init, payer = depositor, space = 8 + 32 + 32 + 8 + 8 + 1)]
    pub escrow: Account<'info, Escrow>,
    #[account(mut)]
    pub depositor: Signer<'info>,
    /// CHECK: recipient pubkey stored, not signing
    pub recipient: UncheckedAccount<'info>,
    #[account(mut)]
    pub depositor_token_account: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = depositor,
        seeds = [b"vault", depositor.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = vault,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub mint: Account<'info, anchor_spl::token::Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ReleaseEscrow<'info> {
    #[account(mut, has_one = recipient)]
    pub escrow: Account<'info, Escrow>,
    pub recipient: Signer<'info>,
    #[account(mut)]
    pub recipient_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"vault", escrow.depositor.as_ref()],
        bump,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum EscrowError {
    #[msg("Escrow has already been released")]
    AlreadyReleased,
    #[msg("Escrow unlock time has not been reached")]
    NotYetUnlocked,
}

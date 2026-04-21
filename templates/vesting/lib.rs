use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("{{PROGRAM_ID}}");

#[program]
pub mod {{program_name}} {
    use super::*;

    pub fn create_vesting(
        ctx: Context<CreateVesting>,
        total_amount: u64,
        start_time: i64,
        cliff_duration: i64,
        vesting_duration: i64,
    ) -> Result<()> {
        require!(total_amount > 0, VestingError::ZeroAmount);
        require!(vesting_duration > 0, VestingError::InvalidDuration);
        require!(cliff_duration >= 0 && cliff_duration <= vesting_duration, VestingError::InvalidCliff);

        let schedule = &mut ctx.accounts.schedule;
        schedule.beneficiary = ctx.accounts.beneficiary.key();
        schedule.mint = ctx.accounts.mint.key();
        schedule.total_amount = total_amount;
        schedule.claimed_amount = 0;
        schedule.start_time = start_time;
        schedule.cliff_duration = cliff_duration;
        schedule.vesting_duration = vesting_duration;
        schedule.vault_bump = ctx.bumps.vault;

        let cpi_accounts = Transfer {
            from: ctx.accounts.funder_token_account.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.funder.to_account_info(),
        };
        token::transfer(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            total_amount,
        )?;

        msg!("Vesting created: {} tokens over {} seconds", total_amount, vesting_duration);
        Ok(())
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let clock = Clock::get()?;
        let now = clock.unix_timestamp;

        let schedule = &ctx.accounts.schedule;
        require!(
            now >= schedule.start_time + schedule.cliff_duration,
            VestingError::CliffNotReached
        );

        let vesting_end = schedule.start_time.saturating_add(schedule.vesting_duration);
        let elapsed = (now.min(vesting_end) - schedule.start_time).max(0) as u64;
        let vested = (schedule.total_amount as u128)
            .checked_mul(elapsed as u128)
            .unwrap()
            .checked_div(schedule.vesting_duration as u128)
            .unwrap() as u64;
        let claimable = vested.saturating_sub(schedule.claimed_amount);
        require!(claimable > 0, VestingError::NothingToClaim);

        let beneficiary_key = schedule.beneficiary;
        let mint_key = schedule.mint;
        let vault_bump = schedule.vault_bump;

        ctx.accounts.schedule.claimed_amount += claimable;

        let seeds = &[b"vault".as_ref(), beneficiary_key.as_ref(), mint_key.as_ref(), &[vault_bump]];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.beneficiary_token_account.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi_accounts, signer),
            claimable,
        )?;

        msg!("Claimed {} tokens", claimable);
        Ok(())
    }
}

#[account]
pub struct VestingSchedule {
    pub beneficiary: Pubkey,
    pub mint: Pubkey,
    pub total_amount: u64,
    pub claimed_amount: u64,
    pub start_time: i64,
    pub cliff_duration: i64,
    pub vesting_duration: i64,
    pub vault_bump: u8,
}

impl VestingSchedule {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1;
}

#[derive(Accounts)]
pub struct CreateVesting<'info> {
    #[account(init, payer = funder, space = VestingSchedule::LEN)]
    pub schedule: Account<'info, VestingSchedule>,
    #[account(mut)]
    pub funder: Signer<'info>,
    /// CHECK: beneficiary pubkey is stored; does not sign at creation
    pub beneficiary: UncheckedAccount<'info>,
    pub mint: Account<'info, anchor_spl::token::Mint>,
    #[account(mut)]
    pub funder_token_account: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = funder,
        seeds = [b"vault", beneficiary.key().as_ref(), mint.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = vault,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut, has_one = beneficiary)]
    pub schedule: Account<'info, VestingSchedule>,
    pub beneficiary: Signer<'info>,
    #[account(mut)]
    pub beneficiary_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"vault", beneficiary.key().as_ref(), schedule.mint.as_ref()],
        bump = schedule.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum VestingError {
    #[msg("Total amount must be greater than zero")]
    ZeroAmount,
    #[msg("Vesting duration must be greater than zero")]
    InvalidDuration,
    #[msg("Cliff duration must be between zero and vesting duration")]
    InvalidCliff,
    #[msg("Cliff period has not been reached yet")]
    CliffNotReached,
    #[msg("No tokens are available to claim")]
    NothingToClaim,
}
